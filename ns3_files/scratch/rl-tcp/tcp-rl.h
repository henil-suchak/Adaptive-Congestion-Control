/* -*-  Mode: C++; c-file-style: "gnu"; indent-tabs-mode:nil; -*- */
/*
 * TcpRlTimeBased — Bridge between NS-3's TCP congestion control API
 * and the TcpTimeStepEnv shared-memory RL environment for training.
 *
 * This class registers "ns3::TcpRlTimeBased" as an NS-3 TypeId so that
 * sim.cc can look it up via TypeId::LookupByNameFailSafe().
 *
 * Pattern mirrors TcpRlInference (inference side) and the upstream
 * hust-diangroup/ns3-ai examples/rl-tcp/tcp-rl.cc.
 *
 * SHM key is read from the NS3_SHM_ID environment variable (set by
 * training_svc.py).  Falls back to 1234 if not set.
 */

#ifndef TCP_RL_H
#define TCP_RL_H

#include "ns3/tcp-congestion-ops.h"
#include "ns3/tcp-socket-base.h"
#include "tcp-rl-env.h"

namespace ns3 {

class TcpSocketBase;
class Time;

// ── TcpSocketDerived ─────────────────────────────────────────────────────────
// Exposes the congestion-control pointer so we can find our own socket.
class TcpSocketDerived : public TcpSocketBase
{
public:
  static TypeId GetTypeId (void);
  virtual TypeId GetInstanceTypeId () const;
  TcpSocketDerived (void);
  virtual ~TcpSocketDerived (void);
  Ptr<TcpCongestionOps> GetCongestionControlAlgorithm ();
};

// ── TcpRlTimeBased ───────────────────────────────────────────────────────────
// Custom TCP congestion control registered as "ns3::TcpRlTimeBased".
// Delegates all CC hooks to TcpTimeStepEnv (time-step based RL training env).
class TcpRlTimeBased : public TcpCongestionOps
{
public:
  static TypeId GetTypeId (void);
  TcpRlTimeBased (void);
  TcpRlTimeBased (const TcpRlTimeBased &sock);
  ~TcpRlTimeBased (void);

  virtual std::string GetName () const;
  virtual uint32_t GetSsThresh (Ptr<const TcpSocketState> tcb, uint32_t bytesInFlight);
  virtual void IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked);
  virtual void PktsAcked (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked, const Time &rtt);
  virtual void CongestionStateSet (Ptr<TcpSocketState> tcb,
                                   const TcpSocketState::TcpCongState_t newState);
  virtual void CwndEvent (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCAEvent_t event);
  virtual Ptr<TcpCongestionOps> Fork ();
  virtual void ReduceCwnd (Ptr<TcpSocketState> tcb);

protected:
  void CreateEnv ();
  void ConnectSocketCallbacks ();
  static uint64_t GenerateUuid ();

  bool m_cbConnect{false};
  Ptr<TcpSocketBase> m_tcpSocket{0};
  Ptr<TcpTimeStepEnv> env;
};

} // namespace ns3

#endif // TCP_RL_H
