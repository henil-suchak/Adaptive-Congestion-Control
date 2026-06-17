#include <cstdlib>
#include <algorithm>
#include <numeric>
#include "tcp-rl-env.h"

namespace ns3
{

NS_LOG_COMPONENT_DEFINE ("ns3::TcpRlEnv");

static constexpr double EMA_ALPHA = 0.25;
static constexpr double EMA_DECAY = 0.85;

// ── Central Controller ────────────────────────────────────────────────────────

RlCentralController& RlCentralController::Get() {
  const char *shmEnv = std::getenv("NS3_SHM_ID");
  uint16_t shmId = shmEnv ? (uint16_t)std::atoi(shmEnv) : 2333;
  static RlCentralController instance(shmId);
  return instance;
}

RlCentralController::RlCentralController(uint16_t id)
  : Ns3AIRL<sTcpRlEnv, TcpRlAct>(id)
{
  SetCond(2, 0);
  auto env = EnvSetterCond();
  env->numAgents = 0;
  GetCompleted();
}

void RlCentralController::Register(TcpTimeStepEnv* env) {
  m_agents.push_back(env);
  if (!m_started) {
    m_started = true;
    NS_LOG_UNCOND("[RlCentralController] First agent registered, starting central clock");
    Simulator::Schedule(m_timeStep, &RlCentralController::ScheduleNextStateRead, this);
  }
}

void RlCentralController::Unregister(TcpTimeStepEnv* env) {
  auto it = std::find(m_agents.begin(), m_agents.end(), env);
  if (it != m_agents.end()) m_agents.erase(it);
}

void RlCentralController::NotifyGameOver() {
  auto envData = EnvSetterCond();
  size_t numAgentsToPack = std::min(m_agents.size(), (size_t)MAX_AGENTS);
  envData->numAgents = numAgentsToPack;
  for (size_t i = 0; i < numAgentsToPack; ++i) {
    envData->envType[i] = 1; // Game Over
  }
  SetCompleted();
}

void RlCentralController::ScheduleNextStateRead() {
  Simulator::Schedule(m_timeStep, &RlCentralController::SendObsGetAction, this);
}

void RlCentralController::SendObsGetAction() {
  if (m_agents.empty()) {
    if (Simulator::Now() + m_timeStep < Simulator::GetMaximumSimulationTime())
      ScheduleNextStateRead();
    return;
  }

  auto envData = EnvSetterCond();
  
  size_t numAgentsToPack = std::min(m_agents.size(), (size_t)MAX_AGENTS);
  envData->numAgents = numAgentsToPack;
  envData->simTime_us = Simulator::Now().GetMicroSeconds();

  for (size_t i = 0; i < numAgentsToPack; ++i) {
    m_agents[i]->FillEnvData(envData, i);
  }

  SetCompleted();

  auto actData = ActionGetterCond();
  
  for (size_t i = 0; i < numAgentsToPack; ++i) {
    m_agents[i]->ApplyAction(actData, i);
  }

  GetCompleted();

  if (Simulator::Now() + m_timeStep < Simulator::GetMaximumSimulationTime())
    ScheduleNextStateRead();
}

// ── TcpRlEnv ─────────────────────────────────────────────────────────────────

TcpRlEnv::TcpRlEnv (uint16_t id) { }

void TcpRlEnv::SetNodeId (uint32_t id) { m_nodeId = id; }
void TcpRlEnv::SetSocketUuid (uint32_t id) { m_socketUuid = id; }

void TcpRlEnv::TxPktTrace (Ptr<const Packet>, const TcpHeader &, Ptr<const TcpSocketBase>)
{
  if (m_lastPktTxTime > MicroSeconds (0.0)) {
    Time interTxTime = Simulator::Now () - m_lastPktTxTime;
    m_interTxTimeSum += interTxTime;
    m_interTxTimeNum++;
  }
  m_lastPktTxTime = Simulator::Now ();
}

void TcpRlEnv::RxPktTrace (Ptr<const Packet>, const TcpHeader &, Ptr<const TcpSocketBase>)
{
  if (m_lastPktRxTime > MicroSeconds (0.0)) {
    Time interRxTime = Simulator::Now () - m_lastPktRxTime;
    m_interRxTimeSum += interRxTime;
    m_interRxTimeNum++;
  }
  m_lastPktRxTime = Simulator::Now ();
}

// ── TcpTimeStepEnv ───────────────────────────────────────────────────────────

double TcpTimeStepEnv::s_bottleneckBps = 2000000.0;

TcpTimeStepEnv::TcpTimeStepEnv (uint16_t id) : TcpRlEnv (id)
{
  RlCentralController::Get().Register(this);
}

TcpTimeStepEnv::~TcpTimeStepEnv ()
{
  RlCentralController::Get().Unregister(this);
}

uint32_t TcpTimeStepEnv::GetSsThresh (Ptr<const TcpSocketState> tcb, uint32_t bytesInFlight)
{ return m_new_ssThresh; }

void TcpTimeStepEnv::IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked)
{
  m_tcb = tcb;
  if (tcb->m_congState == TcpSocketState::CA_OPEN || tcb->m_congState == TcpSocketState::CA_DISORDER) {
    tcb->m_cWnd = m_new_cWnd;
    tcb->m_ssThresh = m_new_ssThresh;
  }
}

void TcpTimeStepEnv::PktsAcked (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked, const Time &rtt)
{
  m_tcb = tcb;
  m_segmentsAckedTracking.push_back (segmentsAcked);
  if (rtt > MicroSeconds (0)) {
    m_rttSum = m_rttSum + rtt;
    m_rttSampleNum++;
  }
  if (tcb->m_congState == TcpSocketState::CA_OPEN || tcb->m_congState == TcpSocketState::CA_DISORDER) {
    tcb->m_cWnd = m_new_cWnd;
    tcb->m_ssThresh = m_new_ssThresh;
  }
}

void TcpTimeStepEnv::CongestionStateSet (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCongState_t newState)
{
  m_tcb = tcb;
  if (newState == TcpSocketState::CA_LOSS) m_packetLossCount++;
  if (newState == TcpSocketState::CA_OPEN || newState == TcpSocketState::CA_DISORDER) {
    tcb->m_cWnd = m_new_cWnd;
    tcb->m_ssThresh = m_new_ssThresh;
  }
}

void TcpTimeStepEnv::CwndEvent (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCAEvent_t event)
{
  m_tcb = tcb;
  if (tcb->m_congState == TcpSocketState::CA_OPEN || tcb->m_congState == TcpSocketState::CA_DISORDER) {
    tcb->m_cWnd = m_new_cWnd;
    tcb->m_ssThresh = m_new_ssThresh;
  }
}

void TcpTimeStepEnv::FillEnvData (sTcpRlEnv* envData, size_t index)
{
  if (m_tcb) m_bytesInFlight.push_back(m_tcb->m_bytesInFlight.Get());

  double rawTput = 0.0;
  if (m_interRxTimeNum > 0 && m_interRxTimeSum > MicroSeconds(0.0)) {
    double interRxTimeSec = m_interRxTimeSum.GetSeconds() / m_interRxTimeNum;
    if (interRxTimeSec > 0) rawTput = (m_tcb ? m_tcb->m_segmentSize * 8.0 : 340 * 8.0) / interRxTimeSec;
  }

  if (m_rttSampleNum > 0) {
    double rawRtt_us = m_rttSum.GetMicroSeconds() / (double)m_rttSampleNum;
    /*
     * - When ACK arrives: smoothed = ALPHA*new + (1-ALPHA)*smoothed
     * - On idle step:     smoothedTput = DECAY * smoothedTput (RTT is carried forward EXACTLY)
     * - Write smoothed values to shared memory instead of raw zeros.
     *
     * Result: idle steps carry forward last-known RTT exactly and decay throughput toward 0.
     */
    m_smoothedRtt_us = EMA_ALPHA * rawRtt_us + (1.0 - EMA_ALPHA) * m_smoothedRtt_us;
  } else {
    m_smoothedRtt_us = m_smoothedRtt_us;
  }

  if (rawTput > 0) {
    m_smoothedTput = EMA_ALPHA * rawTput + (1.0 - EMA_ALPHA) * m_smoothedTput;
  } else {
    m_smoothedTput = EMA_DECAY * m_smoothedTput;
  }

  envData->nodeId[index] = m_nodeId;
  envData->socketUid[index] = m_socketUuid;
  envData->envType[index] = 0;
  envData->ssThresh[index] = m_tcb ? m_tcb->m_ssThresh.Get() : m_new_ssThresh;
  envData->cWnd[index] = m_tcb ? m_tcb->m_cWnd.Get() : m_new_cWnd;
  envData->segmentSize[index] = m_tcb ? m_tcb->m_segmentSize : 340;
  envData->segmentsAcked[index] = std::accumulate(m_segmentsAckedTracking.begin(), m_segmentsAckedTracking.end(), 0);
  
  uint32_t currentBif = m_tcb ? m_tcb->m_bytesInFlight.Get() : 0;
  if (!m_bytesInFlight.empty()) {
    currentBif = std::accumulate(m_bytesInFlight.begin(), m_bytesInFlight.end(), 0) / m_bytesInFlight.size();
  }
  envData->bytesInFlight[index] = currentBif;
  envData->rtt_us[index] = (int64_t)m_smoothedRtt_us;
  envData->throughput[index] = m_smoothedTput;
  envData->packetLoss[index] = m_packetLossCount;

  m_rttSampleNum = 0;
  m_rttSum = MicroSeconds(0);
  m_interRxTimeNum = 0;
  m_interRxTimeSum = MicroSeconds(0);
  m_interTxTimeNum = 0;
  m_interTxTimeSum = MicroSeconds(0);
  m_packetLossCount = 0;
  m_bytesInFlight.clear();
  m_segmentsAckedTracking.clear();
}

void TcpTimeStepEnv::ApplyAction (TcpRlAct* actData, size_t index)
{
  uint32_t cwndCap = std::max(10000.0, s_bottleneckBps * 0.2 / 8.0);
  uint32_t new_cWnd = std::min(actData->new_cWnd[index], cwndCap);
  uint32_t new_ssThresh = std::min(actData->new_ssThresh[index], cwndCap);

  m_new_cWnd = std::max(new_cWnd, m_tcb ? m_tcb->m_segmentSize : (uint32_t)340);
  m_new_ssThresh = std::max(new_ssThresh, m_tcb ? m_tcb->m_segmentSize : (uint32_t)340);

  if (m_tcb && (m_tcb->m_congState == TcpSocketState::CA_OPEN || m_tcb->m_congState == TcpSocketState::CA_DISORDER)) {
    m_tcb->m_cWnd = m_new_cWnd;
    m_tcb->m_ssThresh = m_new_ssThresh;
  }
}

} // namespace ns3