#pragma once
#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/tcp-header.h"
#include "ns3/tcp-socket-base.h"
#include "ns3/ns3-ai-module.h"

namespace ns3 {

#define MAX_AGENTS 10

#pragma pack(push, 1)
struct sTcpRlEnv
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

struct TcpRlAct
{
  uint32_t new_ssThresh[MAX_AGENTS];
  uint32_t new_cWnd[MAX_AGENTS];
};
#pragma pack(pop)

class TcpTimeStepEnv;

class RlCentralController : public Ns3AIRL<sTcpRlEnv, TcpRlAct>
{
public:
  static RlCentralController& Get();

  void Register(TcpTimeStepEnv* env);
  void Unregister(TcpTimeStepEnv* env);
  void NotifyGameOver();

private:
  RlCentralController(uint16_t id);
  void ScheduleNextStateRead();
  void SendObsGetAction();

  std::vector<TcpTimeStepEnv*> m_agents;
  bool m_started{false};
  Time m_timeStep{MilliSeconds(40)};
};

class TcpRlEnv : public SimpleRefCount<TcpRlEnv>
{
public:
  TcpRlEnv () = delete;
  TcpRlEnv (uint16_t id);
  virtual ~TcpRlEnv() {}
  void SetNodeId (uint32_t id);
  void SetSocketUuid (uint32_t id);
  void TxPktTrace (Ptr<const Packet>, const TcpHeader &, Ptr<const TcpSocketBase>);
  void RxPktTrace (Ptr<const Packet>, const TcpHeader &, Ptr<const TcpSocketBase>);

  virtual uint32_t GetSsThresh (Ptr<const TcpSocketState> tcb, uint32_t bytesInFlight) = 0;
  virtual void IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked) = 0;
  virtual void PktsAcked (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked, const Time &rtt) = 0;
  virtual void CongestionStateSet (Ptr<TcpSocketState> tcb,
                                   const TcpSocketState::TcpCongState_t newState) = 0;
  virtual void CwndEvent (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCAEvent_t event) = 0;

protected:
  uint32_t m_nodeId{0};
  uint32_t m_socketUuid{0};

  bool  m_isGameOver{false};
  float m_envReward{0.0};

  Time     m_lastPktTxTime{MicroSeconds (0.0)};
  Time     m_lastPktRxTime{MicroSeconds (0.0)};
  uint64_t m_interTxTimeNum{0};
  Time     m_interTxTimeSum{MicroSeconds (0.0)};
  uint64_t m_interRxTimeNum{0};
  Time     m_interRxTimeSum{MicroSeconds (0.0)};

  uint32_t m_new_ssThresh{65535};
  uint32_t m_new_cWnd{3400};
};

class TcpTimeStepEnv : public TcpRlEnv
{
public:
  TcpTimeStepEnv () = delete;
  TcpTimeStepEnv (uint16_t id);
  ~TcpTimeStepEnv ();

  virtual uint32_t GetSsThresh (Ptr<const TcpSocketState> tcb, uint32_t bytesInFlight);
  virtual void IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked);
  virtual void PktsAcked (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked, const Time &rtt);
  virtual void CongestionStateSet (Ptr<TcpSocketState> tcb,
                                   const TcpSocketState::TcpCongState_t newState);
  virtual void CwndEvent (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCAEvent_t event);

  void FillEnvData (sTcpRlEnv* envData, size_t index);
  void ApplyAction (TcpRlAct* actData, size_t index);

public:
  static double s_bottleneckBps;

private:
  bool m_started{false};
  Time m_timeStep{MilliSeconds (40)};
  Ptr<TcpSocketState> m_tcb{nullptr};

  std::vector<uint32_t> m_bytesInFlight;
  std::vector<uint32_t> m_segmentsAckedTracking;

  uint64_t m_rttSampleNum{0};
  Time     m_rttSum{MicroSeconds (0.0)};
  uint32_t m_packetLossCount{0};

  double m_smoothedRtt_us{0.0};
  double m_smoothedTput{0.0};
};

} // namespace ns3
