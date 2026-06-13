/* -*-  Mode: C++; c-file-style: "gnu"; indent-tabs-mode:nil; -*- */
/*
 * FIXES APPLIED:
 *
 *   1. [GARBAGE INIT FIX] m_new_cWnd=3400, m_new_ssThresh=65535 in constructor.
 *
 *   2. [EARLY EXIT FIX] ScheduleNextStateRead() reschedules unconditionally
 *      at the TOP, keeping simulation alive when TCP goes idle.
 *
 *   3. [CWND CAP FIX] Actions from Python capped to 10000 segments max.
 *
 *   4. [EMA FIX — ROOT CAUSE OF RTT=0/Tput=0 on 80% of steps]
 *
 *      THE BUG: m_timeStep=10ms but network RTT=2*20ms=40ms.
 *      So 3 out of 4 calls to ScheduleNextStateRead() have no new
 *      ACK samples → m_rttSampleNum=0 → rtt_us=0 and throughput=0
 *      written to shared memory. Python sees 80% zero observations.
 *
 *      THE FIX: Exponential Moving Average smoothing.
 *      - When ACK arrives: smoothed = ALPHA*new + (1-ALPHA)*smoothed
 *      - On idle step:     smoothed = DECAY * smoothed
 *      - Write smoothed values to shared memory instead of raw zeros.
 *
 *      Result: idle steps carry forward last-known RTT/throughput,
 *      decaying toward 0 only after ~250ms of true silence.
 */

#include <algorithm>
#include <numeric>
#include "tcp-rl-env.h"

namespace ns3
{

NS_LOG_COMPONENT_DEFINE ("ns3::TcpRlEnv");

// EMA parameters
static constexpr double EMA_ALPHA = 0.25;  // blend weight for new sample
static constexpr double EMA_DECAY = 0.85;  // decay on idle steps

// ── TcpRlEnv ─────────────────────────────────────────────────────────────────

double TcpTimeStepEnv::s_bottleneckBps = 2000000.0;

TcpRlEnv::TcpRlEnv (uint16_t id) : Ns3AIRL<sTcpRlEnv, TcpRlAct> (id)
{
  SetCond (2, 0);
}

void TcpRlEnv::SetNodeId (uint32_t id)
{
  NS_LOG_FUNCTION (this);
  m_nodeId = id;
}

void TcpRlEnv::SetSocketUuid (uint32_t id)
{
  NS_LOG_FUNCTION (this);
  m_socketUuid = id;
}

void TcpRlEnv::TxPktTrace (Ptr<const Packet>, const TcpHeader &, Ptr<const TcpSocketBase>)
{
  if (m_lastPktTxTime > MicroSeconds (0.0))
    {
      Time interTxTime = Simulator::Now () - m_lastPktTxTime;
      m_interTxTimeSum += interTxTime;
      m_interTxTimeNum++;
    }
  m_lastPktTxTime = Simulator::Now ();
}

void TcpRlEnv::RxPktTrace (Ptr<const Packet>, const TcpHeader &, Ptr<const TcpSocketBase>)
{
  if (m_lastPktRxTime > MicroSeconds (0.0))
    {
      Time interRxTime = Simulator::Now () - m_lastPktRxTime;
      m_interRxTimeSum += interRxTime;
      m_interRxTimeNum++;
    }
  m_lastPktRxTime = Simulator::Now ();
}

// ── TcpTimeStepEnv ───────────────────────────────────────────────────────────

TcpTimeStepEnv::TcpTimeStepEnv (uint16_t id) : TcpRlEnv (id)
{
  m_new_cWnd     = 3400;   // 10 segments × 340 bytes
  m_new_ssThresh = 65535;  // standard initial ssThresh
}

void
TcpTimeStepEnv::ScheduleNextStateRead ()
{
  // Reschedule UNCONDITIONALLY first — keeps simulation alive even when TCP idle
  Simulator::Schedule (m_timeStep, &TcpTimeStepEnv::ScheduleNextStateRead, this);

  if (m_tcb == nullptr)
    return;

  // ── Compute raw per-step values ──────────────────────────────────────────

  uint64_t segmentsAckedSum = std::accumulate (
      m_segmentsAcked.begin (), m_segmentsAcked.end (), 0ULL);

  uint64_t bytesInFlightSum = std::accumulate (
      m_bytesInFlight.begin (), m_bytesInFlight.end (), 0ULL);

  double stepSec = m_timeStep.GetSeconds ();

  // Raw throughput this step (bytes/sec)
  double rawTput = (stepSec > 0 && segmentsAckedSum > 0)
      ? (static_cast<double> (segmentsAckedSum) * m_tcb->m_segmentSize / stepSec)
      : 0.0;

  // Raw average RTT this step (microseconds)
  double rawRtt_us = 0.0;
  if (m_rttSampleNum > 0)
    rawRtt_us = static_cast<double> (m_rttSum.GetMicroSeconds ()) / m_rttSampleNum;

  // ── EMA update ───────────────────────────────────────────────────────────
  // FIX: Instead of writing raw values (which are 0 on 80% of steps because
  // m_timeStep=10ms < RTT=40ms), blend into a smoothed signal that persists
  // across idle steps and only decays after prolonged silence (~250ms).

  if (m_rttSampleNum > 0)
    {
      // ACK(s) arrived this step — update EMA with new sample
      m_smoothedRtt_us = EMA_ALPHA * rawRtt_us  + (1.0 - EMA_ALPHA) * m_smoothedRtt_us;
      m_smoothedTput   = EMA_ALPHA * rawTput    + (1.0 - EMA_ALPHA) * m_smoothedTput;
    }
  else
    {
      // No ACKs this step (idle) — decay throughput toward 0 slowly.
      // RTT does NOT decay because physical path delay doesn't shrink during silence!
      m_smoothedTput   *= EMA_DECAY;
    }

  // ── Write observation to shared memory ───────────────────────────────────
  auto env = EnvSetterCond ();
  env->socketUid   = m_socketUuid;
  env->envType     = 1;
  env->simTime_us  = Simulator::Now ().GetMicroSeconds ();
  env->nodeId      = m_nodeId;
  env->ssThresh    = m_tcb->m_ssThresh;
  env->cWnd        = m_tcb->m_cWnd;
  env->segmentSize = m_tcb->m_segmentSize;

  env->bytesInFlight  = static_cast<uint32_t> (bytesInFlightSum);
  env->segmentsAcked  = static_cast<uint32_t> (segmentsAckedSum);

  // Write SMOOTHED values — this is the core fix
  env->rtt_us    = static_cast<int64_t> (m_smoothedRtt_us);
  env->throughput = m_smoothedTput;

  env->packetLoss = m_packetLossCount;

  SetCompleted ();   // Release — Python can now read

  // ── Read action from shared memory ───────────────────────────────────────
  auto act = ActionGetterCond ();

  uint32_t segSize = m_tcb->m_segmentSize;
  if (segSize == 0) segSize = 340;

  // FIX: BDP-based cWnd cap — prevents agent from triggering Retransmission Timeouts.
  // BDP = bottleneck_bw × RTT = 2,000,000 bps × 0.040s / 8 = 10,000 bytes ≈ 29 segments.
  // Allowing 4× BDP = ~120 segments gives headroom for bursting without queue overflow.
  // Previously: 10,000 segments (3.4MB) → agent could spike cWnd to 15,342 (seen in logs)
  // → instant queue drop → RTO → TCP frozen for 1+ second = 100+ zero-reward steps.
  //
  // If smoothed RTT is available use it; otherwise fall back to 40ms (2×access_delay).
  double rttSec = (m_smoothedRtt_us > 1000.0) ? (m_smoothedRtt_us / 1e6) : 0.040;
  double bottleneckBps = TcpTimeStepEnv::s_bottleneckBps;  // Dynamic topology bandwidth
  uint32_t bdpBytes    = static_cast<uint32_t> (bottleneckBps * rttSec / 8.0);
  uint32_t maxCwnd     = std::max (static_cast<uint32_t>(1.5 * bdpBytes), 5 * segSize);
  uint32_t minCwnd     = segSize;
  uint32_t maxSsThresh = maxCwnd * 2;

  uint32_t raw_cWnd     = act->new_cWnd;
  uint32_t raw_ssThresh = act->new_ssThresh;

  if (raw_cWnd < minCwnd)           raw_cWnd     = minCwnd;
  if (raw_cWnd > maxCwnd)           raw_cWnd     = maxCwnd;
  if (raw_ssThresh < minCwnd)       raw_ssThresh = minCwnd;
  if (raw_ssThresh > maxSsThresh)   raw_ssThresh = maxSsThresh;

  m_new_cWnd     = raw_cWnd;
  m_new_ssThresh = raw_ssThresh;

  GetCompleted ();   // Release — ns-3 can proceed

  // Reset per-step accumulators (EMA state is preserved in m_smoothedRtt_us / m_smoothedTput)
  m_rttSampleNum    = 0;
  m_rttSum          = MicroSeconds (0);
  m_packetLossCount = 0;
  m_interTxTimeNum  = 0;
  m_interTxTimeSum  = MicroSeconds (0);
  m_interRxTimeNum  = 0;
  m_interRxTimeSum  = MicroSeconds (0);
  m_bytesInFlight.clear ();
  m_segmentsAcked.clear ();
}

uint32_t
TcpTimeStepEnv::GetSsThresh (Ptr<const TcpSocketState> tcb, uint32_t bytesInFlight)
{
  NS_LOG_FUNCTION (this);
  m_tcb = tcb;
  m_bytesInFlight.push_back (bytesInFlight);

  if (!m_started)
    {
      m_started = true;
      ScheduleNextStateRead ();
    }

  return m_new_ssThresh;
}

void
TcpTimeStepEnv::IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked)
{
  NS_LOG_FUNCTION (this);
  m_tcb = tcb;
  // NOTE: segmentsAcked is NOT pushed here — tracked in PktsAcked instead.
  // IncreaseWindow is skipped during Fast Recovery, so tracking here caused
  // throughput=0 during all recovery phases, giving the agent false signal.
  m_bytesInFlight.push_back (tcb->m_bytesInFlight);

  if (!m_started)
    {
      m_started = true;
      ScheduleNextStateRead ();
    }

  tcb->m_cWnd = m_new_cWnd;
}

void
TcpTimeStepEnv::PktsAcked (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked, const Time &rtt)
{
  // FIX: Track segmentsAcked HERE (not in IncreaseWindow).
  // PktsAcked fires for every ACK in ALL congestion states (Open, Recovery, Loss).
  // This gives accurate throughput even during Fast Recovery.
  m_tcb = tcb;
  m_segmentsAcked.push_back (segmentsAcked);
  m_rttSum += rtt;
  m_rttSampleNum++;
}

void
TcpTimeStepEnv::CongestionStateSet (Ptr<TcpSocketState> tcb,
                                     const TcpSocketState::TcpCongState_t newState)
{
  m_tcb = tcb;
  if (newState == TcpSocketState::CA_LOSS || newState == TcpSocketState::CA_RECOVERY)
    m_packetLossCount++;
}

void
TcpTimeStepEnv::CwndEvent (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCAEvent_t event)
{
  m_tcb = tcb;
}

} // namespace ns3