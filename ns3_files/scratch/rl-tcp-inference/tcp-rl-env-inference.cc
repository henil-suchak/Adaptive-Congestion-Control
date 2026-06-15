#include "tcp-rl-env-inference.h"
#include <cstdlib>
#include "ns3/log.h"
#include "ns3/simulator.h"
#include "ns3/tcp-header.h"
#include <algorithm>

namespace ns3 {

NS_LOG_COMPONENT_DEFINE ("TcpRlInferenceEnv");

// ── Central Controller ────────────────────────────────────────────────────────

TcpRlInferenceCentralController& TcpRlInferenceCentralController::Get() {
  const char *shmEnv = std::getenv("NS3_SHM_ID");
  uint16_t shmId = shmEnv ? (uint16_t)std::atoi(shmEnv) : 2334;
  static TcpRlInferenceCentralController instance(shmId);
  return instance;
}

TcpRlInferenceCentralController::TcpRlInferenceCentralController(uint16_t id)
  : Ns3AIRL<sTcpRlInferenceEnv, TcpRlInferenceAct>(id)
{
  SetCond (2, 0);        // C++ acquires when version%2==0
  auto env     = EnvSetterCond ();
  env->numAgents = 0;
  GetCompleted ();       // RollBack → nextVersion stays 0
}

void TcpRlInferenceCentralController::Register(TcpRlInferenceEnv* env) {
  m_agents.push_back(env);
  if (!m_started) {
    m_started = true;
    NS_LOG_UNCOND ("[TcpRlInferenceCentralController] First agent registered, starting central clock");
    Simulator::Schedule(m_timeStep, &TcpRlInferenceCentralController::ScheduleNextStep, this);
  }
}

void TcpRlInferenceCentralController::Unregister(TcpRlInferenceEnv* env) {
  auto it = std::find(m_agents.begin(), m_agents.end(), env);
  if (it != m_agents.end()) m_agents.erase(it);
}

void TcpRlInferenceCentralController::ScheduleNextStep() {
  Simulator::Schedule(m_timeStep, &TcpRlInferenceCentralController::SendObsGetAction, this);
}

void TcpRlInferenceCentralController::SendObsGetAction() {
  if (m_agents.empty()) {
    if (Simulator::Now() + m_timeStep < Simulator::GetMaximumSimulationTime())
      ScheduleNextStep();
    return;
  }

  // ── Write observations for ALL agents ──────────────────────────────────────
  auto envData = EnvSetterCond();
  
  // Guard against buffer overflow
  size_t numAgentsToPack = std::min(m_agents.size(), (size_t)MAX_AGENTS);
  envData->numAgents = numAgentsToPack;
  envData->simTime_us = Simulator::Now().GetMicroSeconds();

  for (size_t i = 0; i < numAgentsToPack; ++i) {
    m_agents[i]->FillEnvData(envData, i);
  }

  SetCompleted(); // Unlock memory for Python

  // ── Read actions for ALL agents ────────────────────────────────────────────
  auto actData = ActionGetterCond();
  
  for (size_t i = 0; i < numAgentsToPack; ++i) {
    m_agents[i]->ApplyAction(actData, i);
  }

  GetCompleted(); // Release and rollback version

  if (Simulator::Now() + m_timeStep < Simulator::GetMaximumSimulationTime())
    ScheduleNextStep();
}

// ── Agent Environment ─────────────────────────────────────────────────────────

TcpRlInferenceEnv::TcpRlInferenceEnv (uint16_t id)
{
  TcpRlInferenceCentralController::Get().Register(this);
}

TcpRlInferenceEnv::~TcpRlInferenceEnv ()
{
  TcpRlInferenceCentralController::Get().Unregister(this);
}

void TcpRlInferenceEnv::SetNodeId (uint32_t id)     { m_nodeId     = id; }
void TcpRlInferenceEnv::SetSocketUuid (uint32_t id) { m_socketUuid = id; }

void TcpRlInferenceEnv::TxPktTrace (Ptr<const Packet> p, const TcpHeader &, Ptr<const TcpSocketBase>)
{ m_txBytes += p->GetSize (); }

void TcpRlInferenceEnv::RxPktTrace (Ptr<const Packet> p, const TcpHeader &, Ptr<const TcpSocketBase>)
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

uint32_t TcpRlInferenceEnv::GetSsThresh (Ptr<const TcpSocketState> tcb, uint32_t bytesInFlight)
{ return m_new_ssThresh; }

void TcpRlInferenceEnv::IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked)
{
  m_tcb = tcb;
  ApplyCwndIfSafe (tcb);
}

void TcpRlInferenceEnv::PktsAcked (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked, const Time &rtt)
{
  m_tcb = tcb;
  m_segmentsAcked += segmentsAcked;

  if (!m_started) {
    m_started = true;
    NS_LOG_UNCOND ("[TcpRlInferenceEnv] First PktsAcked at t=" << Simulator::Now().GetSeconds() << "s for Node " << m_nodeId);
  }

  if (rtt > MicroSeconds (0))
    {
      m_rttSum = m_rttSum + rtt;
      m_rttSampleNum++;
    }

  ApplyCwndIfSafe (tcb);
}

void TcpRlInferenceEnv::CongestionStateSet (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCongState_t newState)
{
  m_tcb = tcb;
  if (newState == TcpSocketState::CA_LOSS)
    m_packetLossCount++;

  if (newState == TcpSocketState::CA_OPEN || newState == TcpSocketState::CA_DISORDER)
    {
      tcb->m_cWnd     = m_new_cWnd;
      tcb->m_ssThresh = m_new_ssThresh;
    }
}

void TcpRlInferenceEnv::CwndEvent (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCAEvent_t event)
{
  m_tcb = tcb;
  ApplyCwndIfSafe (tcb);
}

void TcpRlInferenceEnv::FillEnvData (sTcpRlInferenceEnv* envData, size_t index)
{
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

  envData->nodeId[index]        = m_nodeId;
  envData->socketUid[index]     = m_socketUuid;
  envData->envType[index]       = 1;
  envData->ssThresh[index]      = m_tcb ? m_tcb->m_ssThresh.Get () : m_new_ssThresh;
  envData->cWnd[index]          = m_tcb ? m_tcb->m_cWnd.Get ()     : m_new_cWnd;
  envData->segmentSize[index]   = m_tcb ? m_tcb->m_segmentSize      : 340;
  envData->segmentsAcked[index] = m_segmentsAcked;
  envData->bytesInFlight[index] = m_tcb ? m_tcb->m_bytesInFlight.Get () : 0;
  envData->rtt_us[index]        = (int64_t)m_smoothedRtt_us;
  envData->throughput[index]    = m_smoothedTput;
  envData->packetLoss[index]    = m_packetLossCount;

  // Reset step variables
  m_rttSampleNum    = 0;
  m_rttSum          = MicroSeconds (0);
  m_segmentsAcked   = 0;
  m_packetLossCount = 0;
  m_rxBytes         = 0;
  m_txBytes         = 0;
}

void TcpRlInferenceEnv::ApplyAction (TcpRlInferenceAct* actData, size_t index)
{
  m_new_ssThresh = actData->new_ssThresh[index];
  m_new_cWnd     = actData->new_cWnd[index];

  if (m_tcb)
    ApplyCwndIfSafe (m_tcb);
}

} // namespace ns3