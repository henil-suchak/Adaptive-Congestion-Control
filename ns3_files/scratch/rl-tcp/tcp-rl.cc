/* -*-  Mode: C++; c-file-style: "gnu"; indent-tabs-mode:nil; -*- */
/*
 * TcpRlTimeBased — Bridge between NS-3's TCP congestion control API
 * and the TcpTimeStepEnv shared-memory RL environment for training.
 *
 * Registers "ns3::TcpRlTimeBased" as an NS-3 TypeId so that sim.cc can
 * look it up via TypeId::LookupByNameFailSafe().
 *
 * The pattern mirrors TcpRlInference (inference side) and the upstream
 * hust-diangroup/ns3-ai examples/rl-tcp/tcp-rl.cc.
 *
 * SHM key is read from the NS3_SHM_ID environment variable (set by
 * training_svc.py).  Falls back to 1234 if not set.
 */

#include "tcp-rl.h"
#include "ns3/tcp-header.h"
#include "ns3/object.h"
#include "ns3/node-list.h"
#include "ns3/core-module.h"
#include "ns3/log.h"
#include "ns3/simulator.h"
#include "ns3/tcp-socket-base.h"
#include "ns3/tcp-l4-protocol.h"
#include <cstdlib>
#include <algorithm>

namespace ns3 {

// ── TcpSocketDerived ─────────────────────────────────────────────────────────

NS_OBJECT_ENSURE_REGISTERED (TcpSocketDerived);

TypeId
TcpSocketDerived::GetTypeId (void)
{
  static TypeId tid = TypeId ("ns3::TcpSocketDerived")
                          .SetParent<TcpSocketBase> ()
                          .SetGroupName ("Internet")
                          .AddConstructor<TcpSocketDerived> ();
  return tid;
}

TypeId
TcpSocketDerived::GetInstanceTypeId () const
{
  return TcpSocketDerived::GetTypeId ();
}

TcpSocketDerived::TcpSocketDerived (void) {}
TcpSocketDerived::~TcpSocketDerived (void) {}

Ptr<TcpCongestionOps>
TcpSocketDerived::GetCongestionControlAlgorithm ()
{
  return m_congestionControl;
}

// ── TcpRlTimeBased ───────────────────────────────────────────────────────────

NS_LOG_COMPONENT_DEFINE ("ns3::TcpRlTimeBased");
NS_OBJECT_ENSURE_REGISTERED (TcpRlTimeBased);

TypeId
TcpRlTimeBased::GetTypeId (void)
{
  static TypeId tid = TypeId ("ns3::TcpRlTimeBased")
                          .SetParent<TcpCongestionOps> ()
                          .SetGroupName ("Internet")
                          .AddConstructor<TcpRlTimeBased> ();
  return tid;
}

TcpRlTimeBased::TcpRlTimeBased (void) : TcpCongestionOps ()
{
  NS_LOG_FUNCTION (this);
  m_tcpSocket = 0;
}

TcpRlTimeBased::TcpRlTimeBased (const TcpRlTimeBased &sock) : TcpCongestionOps (sock)
{
  NS_LOG_FUNCTION (this);
  m_tcpSocket = 0;
}

TcpRlTimeBased::~TcpRlTimeBased (void)
{
  NS_LOG_FUNCTION (this);
  m_tcpSocket = 0;
}

std::string
TcpRlTimeBased::GetName () const
{
  return "TcpRlTimeBased";
}

uint64_t
TcpRlTimeBased::GenerateUuid ()
{
  static uint64_t uuid = 0;
  uuid++;
  return uuid;
}

void
TcpRlTimeBased::CreateEnv ()
{
  // CRITICAL: SocketType applies TcpRlTimeBased to ALL sockets (sender + sink).
  // Only the FIRST instance should create the env and own the SHM block.
  static bool s_envCreated = false;
  if (s_envCreated)
    {
      NS_LOG_UNCOND ("[TcpRlTimeBased] Skipping env creation (already created by sender)");
      return;
    }
  s_envCreated = true;

  // Read dynamic SHM key from environment (set by training_svc.py)
  const char *shmEnv = std::getenv ("NS3_SHM_ID");
  uint16_t shmId = shmEnv ? (uint16_t) std::atoi (shmEnv) : 1234;

  NS_LOG_UNCOND ("[TcpRlTimeBased] Creating TcpTimeStepEnv with SHM key=" << shmId);

  env = Create<TcpTimeStepEnv> (shmId);
  env->SetSocketUuid (TcpRlTimeBased::GenerateUuid ());

  ConnectSocketCallbacks ();
}

void
TcpRlTimeBased::ConnectSocketCallbacks ()
{
  bool foundSocket = false;
  for (NodeList::Iterator i = NodeList::Begin (); i != NodeList::End (); ++i)
    {
      Ptr<Node> node = *i;
      Ptr<TcpL4Protocol> tcp = node->GetObject<TcpL4Protocol> ();
      if (!tcp)
        continue;

      ObjectVectorValue socketVec;
      tcp->GetAttribute ("SocketList", socketVec);

      for (uint32_t j = 0; j < socketVec.GetN (); j++)
        {
          Ptr<TcpSocketBase> tcpSocket = DynamicCast<TcpSocketBase> (socketVec.Get (j));
          if (!tcpSocket)
            continue;

          // Check if this socket's CC is us
          PointerValue ccVal;
          tcpSocket->GetAttribute ("CongestionOps", ccVal);
          Ptr<TcpCongestionOps> cc = ccVal.Get<TcpCongestionOps> ();
          Ptr<TcpRlTimeBased> rlCa = DynamicCast<TcpRlTimeBased> (cc);

          if (rlCa != this)
            continue;
          if (foundSocket)
            continue;

          foundSocket = true;
          m_tcpSocket = tcpSocket;

          m_tcpSocket->TraceConnectWithoutContext (
              "Tx", MakeCallback (&TcpRlEnv::TxPktTrace, env));
          m_tcpSocket->TraceConnectWithoutContext (
              "Rx", MakeCallback (&TcpRlEnv::RxPktTrace, env));
          env->SetNodeId (m_tcpSocket->GetNode ()->GetId ());

          NS_LOG_UNCOND ("[TcpRlTimeBased] Connected to node="
                         << m_tcpSocket->GetNode ()->GetId ()
                         << " at t=" << Simulator::Now ().GetSeconds () << "s");
        }
    }

  if (!m_tcpSocket)
    NS_LOG_UNCOND ("[TcpRlTimeBased] WARNING: own socket not found");
}

void
TcpRlTimeBased::ReduceCwnd (Ptr<TcpSocketState> tcb)
{
  tcb->m_cWnd = std::max (tcb->m_cWnd.Get () / 2, tcb->m_segmentSize);
}

uint32_t
TcpRlTimeBased::GetSsThresh (Ptr<const TcpSocketState> tcb, uint32_t bytesInFlight)
{
  if (!m_cbConnect)
    {
      m_cbConnect = true;
      CreateEnv ();
    }
  if (!env)
    return tcb->m_ssThresh;
  return env->GetSsThresh (tcb, bytesInFlight);
}

void
TcpRlTimeBased::IncreaseWindow (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked)
{
  if (!m_cbConnect)
    {
      m_cbConnect = true;
      CreateEnv ();
    }
  if (!env)
    return;
  env->IncreaseWindow (tcb, segmentsAcked);
}

void
TcpRlTimeBased::PktsAcked (Ptr<TcpSocketState> tcb, uint32_t segmentsAcked, const Time &rtt)
{
  if (!m_cbConnect)
    {
      m_cbConnect = true;
      CreateEnv ();
    }
  if (!env)
    return;
  env->PktsAcked (tcb, segmentsAcked, rtt);
}

void
TcpRlTimeBased::CongestionStateSet (Ptr<TcpSocketState> tcb,
                                     const TcpSocketState::TcpCongState_t newState)
{
  if (!m_cbConnect)
    {
      m_cbConnect = true;
      CreateEnv ();
    }
  if (!env)
    return;
  env->CongestionStateSet (tcb, newState);
}

void
TcpRlTimeBased::CwndEvent (Ptr<TcpSocketState> tcb, const TcpSocketState::TcpCAEvent_t event)
{
  if (!m_cbConnect)
    {
      m_cbConnect = true;
      CreateEnv ();
    }
  if (!env)
    return;
  env->CwndEvent (tcb, event);
}

Ptr<TcpCongestionOps>
TcpRlTimeBased::Fork ()
{
  return CopyObject<TcpRlTimeBased> (this);
}

} // namespace ns3
