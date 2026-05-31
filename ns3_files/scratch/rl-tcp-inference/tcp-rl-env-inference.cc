#include "tcp-rl-env-inference.h"
#include "ns3/log.h"
#include "ns3/simulator.h"
#include "ns3/tcp-header.h"

namespace ns3 {

NS_LOG_COMPONENT_DEFINE ("TcpRlInferenceEnv");

TcpRlInferenceEnv::TcpRlInferenceEnv (uint16_t id)
  : Ns3AIRL<sTcpRlInferenceEnv, TcpRlInferenceAct> (id)
{
  SetCond (2, 0);        // C++ acquires when version%2==0
  auto env     = EnvSetterCond ();
  env->envType = 0;
  GetCompleted ();       // RollBack → nextVersion stays 0
}

void TcpRlInferenceEnv::SetNodeId (uint32_t id)     { m_nodeId     = id; }
void TcpRlInferenceEnv::SetSocketUuid (uint32_t id) { m_socketUuid = id; }

void TcpRlInferenceEnv::TxPktTrace (Ptr<const Packet> p,
                                     const TcpHeader &,
                                     Ptr<const TcpSocketBase>)
{ m_txBytes += p->GetSize (); }

void TcpRlInferenceEnv::RxPktTrace (Ptr<const Packet> p,
                                     const TcpHeader &,
                                     Ptr<const TcpSocketBase>)
{ m_rxBytes += p->GetSize (); }

void TcpRlInferenceEnv::ApplyCwndIfSafe (Ptr<TcpSocketState> tcb)
{
  if (tcb->m_congState == TcpSocketState::CA_OPEN
      || tcb->m_congState == TcpSocketState::CA_DISORDER)
    {
      tcb->m_cWnd     = m_new_cWnd;
      tcb->m_ssThresh = m_new_ssThresh;
    }
}

uint32_t TcpRlInferenceEnv::GetSsThresh (Ptr<const TcpSocketState> tcb,
                                          uint32_t bytesInFlight)
{ return m_new_ssThresh; }

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

  if (newState == TcpSocketState::CA_OPEN
      || newState == TcpSocketState::CA_DISORDER)
    {
      tcb->m_cWnd     = m_new_cWnd;
      tcb->m_ssThresh = m_new_ssThresh;
    }
}

void TcpRlInferenceEnv::CwndEvent (Ptr<TcpSocketState> tcb,
                                    const TcpSocketState::TcpCAEvent_t event)
{
  m_tcb = tcb;
  ApplyCwndIfSafe (tcb);
}

void TcpRlInferenceEnv::ScheduleNextStep ()
{
  Simulator::Schedule (m_timeStep, &TcpRlInferenceEnv::SendObsGetAction, this);
}

void TcpRlInferenceEnv::SendObsGetAction ()
{
  NS_LOG_UNCOND ("\n[C++] 🟢 Reached SendObsGetAction! Packing memory...");
  const double EMA_ALPHA = 0.3;

  double stepSec = m_timeStep.GetSeconds ();
  double rawTput = (stepSec > 0) ? (double)m_txBytes / stepSec : 0.0;
  if (rawTput > 0)
    m_smoothedTput = EMA_ALPHA * rawTput + (1.0 - EMA_ALPHA) * m_smoothedTput;

  double rawRtt_us = 0.0;
  if (m_rttSampleNum > 0)
    rawRtt_us = m_rttSum.GetMicroSeconds () / (double)m_rttSampleNum;
  if (rawRtt_us > 0)
    m_smoothedRtt_us = EMA_ALPHA * rawRtt_us + (1.0 - EMA_ALPHA) * m_smoothedRtt_us;

  // ── Write observation ─────────────────────────────────────────────────────
  // EnvSetterCond waits for version%2==0 (guaranteed by GetCompleted rollback)
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
  SetCompleted ();   // ReleaseMemory → version becomes 1 → Python wakes up

  NS_LOG_UNCOND ("[C++] 🟡 Memory unlocked for Python! Waiting for action...");

  // ── Read action ───────────────────────────────────────────────────────────
  // ActionGetterCond waits for version%2==0
  // After Python's ReleaseMemory: version=1→2, and 2%2==0 ✅
  auto act       = ActionGetterCond ();
  m_new_ssThresh = act->new_ssThresh;
  m_new_cWnd     = act->new_cWnd;
  GetCompleted (); // ReleaseMemoryAndRollback → nextVersion rolls back
                   // version stays at 2, nextVersion=2, so next EnvSetterCond
                   // sees version%2==0 ✅

  NS_LOG_UNCOND ("[C++] 🔴 Python responded! Action received. Step complete.\n");

  if (m_tcb)
    ApplyCwndIfSafe (m_tcb);

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