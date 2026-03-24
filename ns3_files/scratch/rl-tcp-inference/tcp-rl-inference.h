#ifndef TCP_RL_INFERENCE_H
#define TCP_RL_INFERENCE_H

#include "ns3/tcp-congestion-ops.h"
#include "ns3/tcp-socket-base.h"
#include "tcp-rl-env-inference.h"

namespace ns3 {

// Exposes the congestion control pointer so we can find our own socket.
class TcpSocketDerivedInference : public TcpSocketBase
{
public:
  static TypeId GetTypeId (void);
  virtual TypeId GetInstanceTypeId () const;
  TcpSocketDerivedInference (void);
  virtual ~TcpSocketDerivedInference (void);
  Ptr<TcpCongestionOps> GetCongestionControlAlgorithm ();
};

// Custom TCP congestion control that reads actions from the SAC model via shm.
// On every ACK ns3 calls IncreaseWindow() → we apply the RL agent's cWnd.
class TcpRlInference : public TcpCongestionOps
{
public:
  static TypeId GetTypeId (void);
  TcpRlInference ();
  TcpRlInference (const TcpRlInference &sock);
  ~TcpRlInference ();

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
  Ptr<TcpRlInferenceEnv> env;
};

} // namespace ns3

#endif
