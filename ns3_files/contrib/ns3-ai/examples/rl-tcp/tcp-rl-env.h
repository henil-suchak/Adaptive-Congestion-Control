/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
/*
 * FIXES APPLIED:
 *   1. [GARBAGE INIT FIX] m_new_cWnd / m_new_ssThresh have safe defaults.
 *
 *   2. [EMA FIX] Added m_smoothedRtt_us and m_smoothedTput to carry
 *      forward last-known RTT and throughput across idle 10ms steps.
 *
 *      ROOT CAUSE of RTT=0 / Tput=0 on 80% of steps:
 *        - m_timeStep = 10ms fires every 10ms
 *        - But network RTT = 2 * access_delay = 2 * 20ms = 40ms
 *        - So 3 out of 4 steps have ZERO new ACKs arriving
 *        - Raw per-step values = 0 on those steps
 *        - EMA decays slowly instead of snapping to 0 instantly
 *
 *      Parameters:
 *        EMA_ALPHA = 0.25  (new sample weight when ACK arrives)
 *        EMA_DECAY = 0.85  (decay factor on idle steps, ~0 after 25 idle steps)
 */

#pragma once
#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/tcp-header.h"
#include "ns3/tcp-socket-base.h"
#include "ns3/ns3-ai-module.h"

namespace ns3 {

struct sTcpRlEnv
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

struct TcpRlAct
{
  uint32_t new_ssThresh;
  uint32_t new_cWnd;
};

class TcpRlEnv : public Ns3AIRL<sTcpRlEnv, TcpRlAct>
{
public:
  TcpRlEnv () = delete;
  TcpRlEnv (uint16_t id);
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

  // Safe default action values — avoids garbage on first IncreaseWindow call
  uint32_t m_new_ssThresh{65535};
  uint32_t m_new_cWnd{3400};
};

class TcpTimeStepEnv : public TcpRlEnv
{
public:
  TcpTimeStepEnv () = delete;
  TcpTimeStepEnv (uint16_t id);

  virtual uint32_t GetSsThresh (Ptr<const TcpSocketState> tcb, uint32_t bytesInFlight);
  virtual void IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked);
  virtual void PktsAcked (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked, const Time &rtt);
  virtual void CongestionStateSet (Ptr<TcpSocketState> tcb,
                                   const TcpSocketState::TcpCongState_t newState);
  virtual void CwndEvent (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCAEvent_t event);

private:
  void ScheduleNextStateRead ();

  bool m_started{false};
  Time m_timeStep{MilliSeconds (40)};
  Ptr<const TcpSocketState> m_tcb{nullptr};

  std::vector<uint32_t> m_bytesInFlight;
  std::vector<uint32_t> m_segmentsAcked;

  uint64_t m_rttSampleNum{0};
  Time     m_rttSum{MicroSeconds (0.0)};
  uint32_t m_packetLossCount{0};

  // ── EMA smoothing state ───────────────────────────────────────────────────
  // Carries forward last-known RTT and throughput across idle 10ms steps
  // so Python sees meaningful signal instead of 0 on 80% of observations.
  //
  // EMA_ALPHA = 0.25: when ACK arrives, blend 25% new + 75% history
  // EMA_DECAY = 0.85: on idle steps, value = 0.85 * previous (~0 after 25 idle steps = 250ms)
  double m_smoothedRtt_us{0.0};  // EMA of rtt_us  [microseconds]
  double m_smoothedTput{0.0};    // EMA of throughput [bytes/sec]
};

} // namespace ns3