#ifndef TCP_RL_ENV_INFERENCE_H
#define TCP_RL_ENV_INFERENCE_H

#include "ns3/ns3-ai-module.h"
#include "ns3/tcp-socket-base.h"
#include "ns3/tcp-socket-state.h"
#include "ns3/tcp-header.h"
#include "ns3/nstime.h"
#include <vector>

namespace ns3 {

#define MAX_AGENTS 10

#pragma pack(push, 1)
struct sTcpRlInferenceEnv
{
  uint16_t numAgents;
  uint32_t nodeId[MAX_AGENTS];
  uint32_t socketUid[MAX_AGENTS];
  uint8_t  envType[MAX_AGENTS];
  int64_t  simTime_us;
  uint32_t ssThresh[MAX_AGENTS];
  uint32_t cWnd[MAX_AGENTS];
  uint32_t segmentSize[MAX_AGENTS];
  uint32_t segmentsAcked[MAX_AGENTS];
  uint32_t bytesInFlight[MAX_AGENTS];
  int64_t  rtt_us[MAX_AGENTS];
  double   throughput[MAX_AGENTS];
  uint32_t packetLoss[MAX_AGENTS];
};

struct TcpRlInferenceAct
{
  uint32_t new_ssThresh[MAX_AGENTS];
  uint32_t new_cWnd[MAX_AGENTS];
};
#pragma pack(pop)

class TcpRlInferenceEnv;

// Central controller to aggregate states into a single SHM block for Python
class TcpRlInferenceCentralController : public Ns3AIRL<sTcpRlInferenceEnv, TcpRlInferenceAct>
{
public:
  static TcpRlInferenceCentralController& Get();

  void Register (TcpRlInferenceEnv* env);
  void Unregister (TcpRlInferenceEnv* env);

private:
  TcpRlInferenceCentralController(uint16_t id);
  void ScheduleNextStep ();
  void SendObsGetAction ();

  std::vector<TcpRlInferenceEnv*> m_agents;
  bool m_started{false};
  Time m_timeStep{MilliSeconds (10)};
};

class TcpRlInferenceEnv : public SimpleRefCount<TcpRlInferenceEnv>
{
public:
  TcpRlInferenceEnv () = delete;
  explicit TcpRlInferenceEnv (uint16_t id);
  ~TcpRlInferenceEnv ();

  void SetNodeId (uint32_t id);
  void SetSocketUuid (uint32_t id);

  void TxPktTrace (Ptr<const Packet>, const TcpHeader &, Ptr<const TcpSocketBase>);
  void RxPktTrace (Ptr<const Packet>, const TcpHeader &, Ptr<const TcpSocketBase>);

  uint32_t GetSsThresh    (Ptr<const TcpSocketState> tcb, uint32_t bytesInFlight);
  void     IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked);
  void     PktsAcked      (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked, const Time &rtt);
  void     CongestionStateSet (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCongState_t newState);
  void     CwndEvent      (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCAEvent_t event);

  // Called by Central Controller
  void FillEnvData (sTcpRlInferenceEnv* envData, size_t index);
  void ApplyAction (TcpRlInferenceAct* actData, size_t index);
  void FirstStart ();

protected:
  uint32_t m_nodeId      {0};
  uint32_t m_socketUuid  {0};
  uint32_t m_new_ssThresh{65535};
  uint32_t m_new_cWnd    {3400};

  uint64_t m_txBytes       {0};
  uint64_t m_rxBytes       {0};

  Ptr<TcpSocketState> m_tcb{nullptr};

private:
  void ApplyCwndIfSafe (Ptr<TcpSocketState> tcb);

  bool     m_started        {false};
  uint64_t m_rttSampleNum   {0};
  Time     m_rttSum         {MicroSeconds (0)};
  uint32_t m_segmentsAcked  {0};
  uint32_t m_packetLossCount{0};
  double   m_smoothedRtt_us {0.0};
  double   m_smoothedTput   {0.0};
  Time     m_timeStep       {MilliSeconds (10)};
};

} // namespace ns3

#endif
