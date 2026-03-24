#ifndef TCP_RL_ENV_INFERENCE_H
#define TCP_RL_ENV_INFERENCE_H

#include "ns3/ns3-ai-module.h"
#include "ns3/tcp-socket-base.h"
#include "ns3/tcp-socket-state.h"
#include "ns3/tcp-header.h"
#include "ns3/nstime.h"

namespace ns3 {

struct sTcpRlInferenceEnv
{
  uint32_t nodeId;
  uint32_t socketUid;
  uint8_t  envType;
  int64_t  simTime_us;
  uint32_t ssThresh;
  uint32_t cWnd;
  uint32_t segmentSize;
  uint32_t segmentsAcked;
  uint32_t bytesInFlight;
  int64_t  rtt_us;
  double   throughput;
  uint32_t packetLoss;
} Packed;

struct TcpRlInferenceAct
{
  uint32_t new_ssThresh;
  uint32_t new_cWnd;
};

// Uses default SimInfoType = RLEmptyInfo (1 byte) → C++ total = 67 bytes.
// Python must also use 1 byte (_pad = c_uint8) to match.
class TcpRlInferenceEnv : public Ns3AIRL<sTcpRlInferenceEnv, TcpRlInferenceAct>
{
public:
  TcpRlInferenceEnv () = delete;
  explicit TcpRlInferenceEnv (uint16_t id);

  void SetNodeId (uint32_t id);
  void SetSocketUuid (uint32_t id);

  // Packet trace callbacks (throughput measurement)
  void TxPktTrace (Ptr<const Packet>, const TcpHeader &, Ptr<const TcpSocketBase>);
  void RxPktTrace (Ptr<const Packet>, const TcpHeader &, Ptr<const TcpSocketBase>);

  // TcpCongestionOps hooks — ns3 calls these on every ACK.
  // Direct read/write access to tcb->m_cWnd and tcb->m_ssThresh.
  uint32_t GetSsThresh    (Ptr<const TcpSocketState> tcb, uint32_t bytesInFlight);
  void     IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked);
  void     PktsAcked      (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked, const Time &rtt);
  void     CongestionStateSet (Ptr<TcpSocketState> tcb,
                               const TcpSocketState::TcpCongState_t newState);
  void     CwndEvent      (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCAEvent_t event);

protected:
  uint32_t m_nodeId      {0};
  uint32_t m_socketUuid  {0};
  uint32_t m_new_ssThresh{65535};
  uint32_t m_new_cWnd    {3400};

  uint64_t m_txBytes       {0};   // bytes sent this step
  uint64_t m_rxBytes       {0};   // bytes received this step

  Ptr<TcpSocketState> m_tcb{nullptr};

private:
  void ScheduleNextStep ();
  void SendObsGetAction ();
  void ApplyCwndIfSafe (Ptr<TcpSocketState> tcb);

  bool     m_started        {false};
  Time     m_timeStep       {MilliSeconds (10)};  // match training step interval
  uint64_t m_rttSampleNum   {0};
  Time     m_rttSum         {MicroSeconds (0)};
  uint32_t m_segmentsAcked  {0};
  uint32_t m_packetLossCount{0};
  double   m_smoothedRtt_us {0.0};
  double   m_smoothedTput   {0.0};
};

} // namespace ns3

#endif
