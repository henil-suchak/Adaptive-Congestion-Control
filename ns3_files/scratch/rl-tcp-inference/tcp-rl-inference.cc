#include "tcp-rl-inference.h"
#include <cstdlib>
#include "ns3/log.h"
#include "ns3/simulator.h"
#include "ns3/tcp-socket-base.h"
#include "ns3/tcp-l4-protocol.h"
#include "ns3/node-list.h"
#include "ns3/object.h"
#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/internet-module.h"
#include <algorithm>

namespace ns3 {

NS_LOG_COMPONENT_DEFINE ("TcpRlInference");

// ── TcpSocketDerivedInference ─────────────────────────────────────────────────

NS_OBJECT_ENSURE_REGISTERED (TcpSocketDerivedInference);

TypeId TcpSocketDerivedInference::GetTypeId (void)
{
  static TypeId tid = TypeId ("ns3::TcpSocketDerivedInference")
      .SetParent<TcpSocketBase> ()
      .SetGroupName ("Internet")
      .AddConstructor<TcpSocketDerivedInference> ();
  return tid;
}

TypeId TcpSocketDerivedInference::GetInstanceTypeId () const
{ return TcpSocketDerivedInference::GetTypeId (); }

TcpSocketDerivedInference::TcpSocketDerivedInference (void) {}
TcpSocketDerivedInference::~TcpSocketDerivedInference (void) {}

Ptr<TcpCongestionOps> TcpSocketDerivedInference::GetCongestionControlAlgorithm ()
{ return m_congestionControl; }

// ── TcpRlInference ────────────────────────────────────────────────────────────

NS_OBJECT_ENSURE_REGISTERED (TcpRlInference);

TypeId TcpRlInference::GetTypeId (void)
{
  static TypeId tid = TypeId ("ns3::TcpRlInference")
      .SetParent<TcpCongestionOps> ()
      .SetGroupName ("Internet")
      .AddConstructor<TcpRlInference> ();
  return tid;
}

TcpRlInference::TcpRlInference (void) : TcpCongestionOps () { m_tcpSocket = 0; }
TcpRlInference::TcpRlInference (const TcpRlInference &sock) : TcpCongestionOps (sock) { m_tcpSocket = 0; }
TcpRlInference::~TcpRlInference (void) { m_tcpSocket = 0; }

std::string TcpRlInference::GetName () const { return "TcpRlInference"; }

uint64_t TcpRlInference::GenerateUuid ()
{ static uint64_t uuid = 0; uuid++; return uuid; }

void TcpRlInference::CreateEnv ()
{
  const char* shmEnv = std::getenv("NS3_SHM_ID");
  uint16_t shmId = shmEnv ? (uint16_t)std::atoi(shmEnv) : 2334; // default inference ID
  env = Create<TcpRlInferenceEnv> (shmId);
  env->SetSocketUuid (TcpRlInference::GenerateUuid ());
  ConnectSocketCallbacks ();
}

void TcpRlInference::ConnectSocketCallbacks ()
{
  bool foundSocket = false;
  for (NodeList::Iterator i = NodeList::Begin (); i != NodeList::End (); ++i)
    {
      Ptr<Node> node = *i;
      Ptr<TcpL4Protocol> tcp = node->GetObject<TcpL4Protocol> ();
      if (!tcp) continue;

      ObjectVectorValue socketVec;
      tcp->GetAttribute ("SocketList", socketVec);

      for (uint32_t j = 0; j < socketVec.GetN (); j++)
        {
          Ptr<TcpSocketBase> tcpSocket =
              DynamicCast<TcpSocketBase> (socketVec.Get (j));
          if (!tcpSocket) continue;

          // Sockets are plain TcpSocketBase (CreateSocket always makes TcpSocketBase).
          // Check if this socket's CC is us via the CongestionOps attribute.
          PointerValue ccVal;
          tcpSocket->GetAttribute ("CongestionOps", ccVal);
          Ptr<TcpCongestionOps> cc = ccVal.Get<TcpCongestionOps> ();
          Ptr<TcpRlInference> rlCa = DynamicCast<TcpRlInference> (cc);

          // Only connect to OUR instance — skip other sockets
          if (rlCa != this) continue;
          if (foundSocket) continue;

          foundSocket = true;
          m_tcpSocket = tcpSocket;

          m_tcpSocket->TraceConnectWithoutContext (
              "Tx", MakeCallback (&TcpRlInferenceEnv::TxPktTrace, env));
          m_tcpSocket->TraceConnectWithoutContext (
              "Rx", MakeCallback (&TcpRlInferenceEnv::RxPktTrace, env));
          env->SetNodeId (m_tcpSocket->GetNode ()->GetId ());

          NS_LOG_UNCOND ("[TcpRlInference] Connected to node="
                        << m_tcpSocket->GetNode ()->GetId ()
                        << " at t=" << Simulator::Now ().GetSeconds () << "s");
        }
    }

  if (!m_tcpSocket)
    NS_LOG_UNCOND ("[TcpRlInference] WARNING: own socket not found");
}

void TcpRlInference::ReduceCwnd (Ptr<TcpSocketState> tcb)
{
  tcb->m_cWnd = std::max (tcb->m_cWnd.Get () / 2, tcb->m_segmentSize);
}

uint32_t TcpRlInference::GetSsThresh (Ptr<const TcpSocketState> tcb, uint32_t bytesInFlight)
{
  if (!m_cbConnect) { m_cbConnect = true; CreateEnv (); }
  if (!env) return tcb->m_ssThresh;
  return env->GetSsThresh (tcb, bytesInFlight);
}

void TcpRlInference::IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked)
{
  if (!m_cbConnect) { m_cbConnect = true; CreateEnv (); }
  if (!env) return;
  env->IncreaseWindow (tcb, segmentsAcked);
}

void TcpRlInference::PktsAcked (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked, const Time &rtt)
{
  if (!m_cbConnect) { m_cbConnect = true; CreateEnv (); }
  if (!env) return;
  env->PktsAcked (tcb, segmentsAcked, rtt);
}

void TcpRlInference::CongestionStateSet (Ptr<TcpSocketState> tcb,
                                          const TcpSocketState::TcpCongState_t newState)
{
  if (!m_cbConnect) { m_cbConnect = true; CreateEnv (); }
  if (!env) return;
  env->CongestionStateSet (tcb, newState);
}

void TcpRlInference::CwndEvent (Ptr<TcpSocketState> tcb,
                                 const TcpSocketState::TcpCAEvent_t event)
{
  if (!m_cbConnect) { m_cbConnect = true; CreateEnv (); }
  if (!env) return;
  env->CwndEvent (tcb, event);
}

Ptr<TcpCongestionOps> TcpRlInference::Fork ()
{ return CopyObject<TcpRlInference> (this); }

} // namespace ns3
