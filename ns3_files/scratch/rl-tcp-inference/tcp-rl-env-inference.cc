#include "tcp-rl-env-inference.h"
#include "ns3/log.h"
#include "ns3/simulator.h"
#include "ns3/tcp-header.h"

namespace ns3 {

NS_LOG_COMPONENT_DEFINE ("TcpRlInferenceEnv");

// No minimum cWnd floor — let the agent control everything directly.

TcpRlInferenceEnv::TcpRlInferenceEnv (uint16_t id)
  : Ns3AIRL<sTcpRlInferenceEnv, TcpRlInferenceAct> (id)
{
  SetCond (2, 0);
  auto env     = EnvSetterCond ();
  env->envType = 0;
  GetCompleted ();
}

void TcpRlInferenceEnv::SetNodeId (uint32_t id)     { m_nodeId     = id; }
void TcpRlInferenceEnv::SetSocketUuid (uint32_t id) { m_socketUuid = id; }

// ── Packet trace callbacks ────────────────────────────────────────────────────

void TcpRlInferenceEnv::TxPktTrace (Ptr<const Packet> p,
                                     const TcpHeader &,
                                     Ptr<const TcpSocketBase>)
{
  m_txBytes += p->GetSize ();
}

void TcpRlInferenceEnv::RxPktTrace (Ptr<const Packet> p,
                                     const TcpHeader &,
                                     Ptr<const TcpSocketBase>)
{
  m_rxBytes += p->GetSize ();
}

// ── Helper: apply RL cWnd only when safe ──────────────────────────────────────

void TcpRlInferenceEnv::ApplyCwndIfSafe (Ptr<TcpSocketState> tcb)
{
  // Only override cWnd in CA_OPEN or CA_DISORDER.
  // In CA_LOSS / CA_RECOVERY ns-3 asserts BytesInFlight <= 1 segment.
  if (tcb->m_congState == TcpSocketState::CA_OPEN
      || tcb->m_congState == TcpSocketState::CA_DISORDER)
    {
      uint32_t cWnd = m_new_cWnd;
      tcb->m_cWnd     = cWnd;
      tcb->m_ssThresh = m_new_ssThresh;
    }
}

// ── TcpCongestionOps hooks ────────────────────────────────────────────────────

uint32_t TcpRlInferenceEnv::GetSsThresh (Ptr<const TcpSocketState> tcb,
                                          uint32_t bytesInFlight)
{
  // Return RL agent's ssThresh, but enforce the floor
  return m_new_ssThresh;
}

void TcpRlInferenceEnv::IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked)
{
  m_tcb = tcb;
  ApplyCwndIfSafe (tcb);
}

void TcpRlInferenceEnv::PktsAcked (Ptr<TcpSocketState> tcb,
                                    uint32_t segmentsAcked,
                                    const Time &rtt)
{
  m_tcb = tcb;
  m_segmentsAcked += segmentsAcked;

  // Start step loop here — PktsAcked fires in ALL states
  if (!m_started)
    {
      m_started = true;
      NS_LOG_UNCOND ("[TcpRlInferenceEnv] First PktsAcked at t="
                    << Simulator::Now ().GetSeconds () << "s — starting step loop");
      ScheduleNextStep ();
    }

  if (rtt > MicroSeconds (0))
    {
      m_rttSum = m_rttSum + rtt;
      m_rttSampleNum++;
    }

  ApplyCwndIfSafe (tcb);
}

void TcpRlInferenceEnv::CongestionStateSet (Ptr<TcpSocketState> tcb,
                                             const TcpSocketState::TcpCongState_t newState)
{
  m_tcb = tcb;
  if (newState == TcpSocketState::CA_LOSS)
    m_packetLossCount++;

  // When recovering FROM loss → CA_OPEN, immediately push cWnd up
  if (newState == TcpSocketState::CA_OPEN
      || newState == TcpSocketState::CA_DISORDER)
    {
      uint32_t cWnd = m_new_cWnd;
      tcb->m_cWnd     = cWnd;
      tcb->m_ssThresh = m_new_ssThresh;
    }
}

void TcpRlInferenceEnv::CwndEvent (Ptr<TcpSocketState> tcb,
                                    const TcpSocketState::TcpCAEvent_t event)
{
  m_tcb = tcb;
  ApplyCwndIfSafe (tcb);
}

// ── Step loop ─────────────────────────────────────────────────────────────────

void TcpRlInferenceEnv::ScheduleNextStep ()
{
  Simulator::Schedule (m_timeStep, &TcpRlInferenceEnv::SendObsGetAction, this);
}

void TcpRlInferenceEnv::SendObsGetAction ()
{
  const double EMA_ALPHA = 0.3;

  // Throughput: bytes SENT this step / step duration (bytes/sec)
  double stepSec = m_timeStep.GetSeconds ();
  double rawTput = (stepSec > 0) ? (double)m_txBytes / stepSec : 0.0;
  if (rawTput > 0)
    m_smoothedTput = EMA_ALPHA * rawTput + (1.0 - EMA_ALPHA) * m_smoothedTput;

  // Compute RTT from PktsAcked samples
  double rawRtt_us = 0.0;
  if (m_rttSampleNum > 0)
    rawRtt_us = m_rttSum.GetMicroSeconds () / (double)m_rttSampleNum;
  if (rawRtt_us > 0)
    m_smoothedRtt_us = EMA_ALPHA * rawRtt_us + (1.0 - EMA_ALPHA) * m_smoothedRtt_us;

  // Write observation to shared memory
  auto env           = EnvSetterCond ();
  env->nodeId        = m_nodeId;
  env->socketUid     = m_socketUuid;
  env->envType       = 1;
  env->simTime_us    = Simulator::Now ().GetMicroSeconds ();
  env->ssThresh      = m_tcb ? m_tcb->m_ssThresh.Get () : m_new_ssThresh;
  env->cWnd          = m_tcb ? m_tcb->m_cWnd.Get ()     : m_new_cWnd;
  env->segmentSize   = m_tcb ? m_tcb->m_segmentSize      : 340;
  env->segmentsAcked = m_segmentsAcked;
  env->bytesInFlight = m_tcb ? m_tcb->m_bytesInFlight.Get () : 0;
  env->rtt_us        = (int64_t)m_smoothedRtt_us;
  env->throughput    = m_smoothedTput;
  env->packetLoss    = m_packetLossCount;
  SetCompleted ();

  // Read action from Python
  auto act       = ActionGetterCond ();
  m_new_ssThresh = act->new_ssThresh;
  m_new_cWnd     = act->new_cWnd;
  GetCompleted ();


  // Apply RL action immediately if in safe state
  if (m_tcb)
    ApplyCwndIfSafe (m_tcb);

  // Reset per-step counters
  m_rttSampleNum    = 0;
  m_rttSum          = MicroSeconds (0);
  m_segmentsAcked   = 0;
  m_packetLossCount = 0;
  m_rxBytes         = 0;
  m_txBytes         = 0;

  if (Simulator::Now () + m_timeStep < Simulator::GetMaximumSimulationTime ())
    ScheduleNextStep ();
}

} // namespace ns3
