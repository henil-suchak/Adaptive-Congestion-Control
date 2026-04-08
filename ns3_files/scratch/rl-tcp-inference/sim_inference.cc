#include <iostream>
#include <fstream>
#include <string>

#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/internet-module.h"
#include "ns3/point-to-point-module.h"
#include "ns3/applications-module.h"
#include "ns3/error-model.h"
#include "ns3/tcp-header.h"
#include "ns3/tcp-socket-state.h"
#include "ns3/ipv4-global-routing-helper.h"
#include "ns3/traffic-control-module.h"
#include "ns3/ns3-ai-module.h"

#include "tcp-rl-inference.h"

using namespace ns3;

NS_LOG_COMPONENT_DEFINE ("TcpRlInferenceSim");

static std::vector<uint32_t> rxPkts;

static void CountRxPkts (uint32_t sinkId, Ptr<const Packet>, const Address &)
{ rxPkts[sinkId]++; }

// ── CUBIC flow metric tracing ────────────────────────────────────────────────

static std::ofstream g_cubicTrace;
static uint32_t  g_cubicCwnd        = 0;
static double    g_cubicRttUs       = 0.0;
static uint32_t  g_cubicLossCount   = 0;
static uint64_t  g_cubicRxBytes     = 0;
static uint64_t  g_cubicRxBytesPrev = 0;
static uint32_t  g_cubicSegSize     = 340;
static uint32_t  g_cubicBytesInFlight = 0;

static void CubicCwndChanged (uint32_t, uint32_t newVal)
{ g_cubicCwnd = newVal; }

static void CubicRttChanged (Time, Time newVal)
{ g_cubicRttUs = newVal.GetMicroSeconds (); }

static void CubicCongStateChanged (TcpSocketState::TcpCongState_t,
                                   TcpSocketState::TcpCongState_t newState)
{ if (newState == TcpSocketState::CA_LOSS) g_cubicLossCount++; }

static void CubicBytesInFlightChanged (uint32_t, uint32_t newVal)
{ g_cubicBytesInFlight = newVal; }

static void CubicRxPkt (Ptr<const Packet> p, const Address &)
{ g_cubicRxBytes += p->GetSize (); }

static void WriteCubicMetrics ()
{
  double now_s      = Simulator::Now ().GetSeconds ();
  double interval_s = 0.1;
  double deltaBytes = (double)(g_cubicRxBytes - g_cubicRxBytesPrev);
  double tputBps    = deltaBytes * 8.0 / interval_s;
  g_cubicRxBytesPrev = g_cubicRxBytes;

  g_cubicTrace << now_s << ","
               << g_cubicCwnd << ","
               << g_cubicRttUs << ","
               << tputBps << ","
               << g_cubicLossCount << ","
               << g_cubicSegSize << ","
               << g_cubicBytesInFlight << "\n";
  g_cubicTrace.flush ();

  g_cubicLossCount = 0;

  if (Simulator::Now () + MilliSeconds (100) <
      Simulator::GetMaximumSimulationTime ())
    Simulator::Schedule (MilliSeconds (100), &WriteCubicMetrics);
}

static void ConnectCubicTraces ()
{
  // Node ordering: routers(0,1), leftNodes(2=SAC,3=CUBIC), rightNodes(4,5)
  // CUBIC sender is node 3, socket index 0
  Config::ConnectWithoutContext (
      "/NodeList/3/$ns3::TcpL4Protocol/SocketList/0/CongestionWindow",
      MakeCallback (&CubicCwndChanged));
  Config::ConnectWithoutContext (
      "/NodeList/3/$ns3::TcpL4Protocol/SocketList/0/RTT",
      MakeCallback (&CubicRttChanged));
  Config::ConnectWithoutContext (
      "/NodeList/3/$ns3::TcpL4Protocol/SocketList/0/CongState",
      MakeCallback (&CubicCongStateChanged));
  Config::ConnectWithoutContext (
      "/NodeList/3/$ns3::TcpL4Protocol/SocketList/0/BytesInFlight",
      MakeCallback (&CubicBytesInFlightChanged));

  NS_LOG_UNCOND ("[CUBIC] Trace callbacks connected at t="
                 << Simulator::Now ().GetSeconds () << "s");

  Simulator::Schedule (MilliSeconds (100), &WriteCubicMetrics);
}

// ── Main ─────────────────────────────────────────────────────────────────────

int main (int argc, char *argv[])
{
  uint32_t    simDuration      = 200;
  std::string bottleneck_bw    = "2Mbps";
  std::string bottleneck_delay = "20ms";
  std::string access_bw        = "10Mbps";
  std::string access_delay     = "20ms";
  uint32_t    mtu_bytes        = 400;
  std::string cubicTraceFile   = "/tmp/cubic_metrics.csv";

  CommandLine cmd;
  cmd.AddValue ("duration",     "Simulation duration (s)",   simDuration);
  cmd.AddValue ("cubicTrace",   "CUBIC metrics output file", cubicTraceFile);
  cmd.Parse (argc, argv);

  // TCP defaults (shared by both flows)
  Config::SetDefault ("ns3::TcpSocket::SegmentSize",  UintegerValue (mtu_bytes - 60));
  Config::SetDefault ("ns3::TcpSocket::DelAckCount",  UintegerValue (1));
  Config::SetDefault ("ns3::TcpSocket::RcvBufSize",   UintegerValue (1 << 21));
  Config::SetDefault ("ns3::TcpSocket::SndBufSize",   UintegerValue (1 << 21));
  g_cubicSegSize = mtu_bytes - 60;

  // ── Topology ───────────────────────────────────────────────────────────────
  //
  //  leftNode[0] (SAC)  ─┐                              ┌─ rightNode[0]
  //                       ├── R0 ══[bottleneck]══ R1 ──┤
  //  leftNode[1] (CUBIC)─┘                              └─ rightNode[1]
  //
  //  All access links: 10 Mbps / 20 ms
  //  Bottleneck:         2 Mbps / 20 ms   FqCoDel 100p
  //

  NodeContainer routers, leftNodes, rightNodes;
  routers.Create (2);       // node 0, 1
  leftNodes.Create (2);     // node 2 = SAC sender, node 3 = CUBIC sender
  rightNodes.Create (2);    // node 4 = SAC receiver, node 5 = CUBIC receiver
  rxPkts.assign (2, 0);

  PointToPointHelper bottleneckLink, accessLink;
  bottleneckLink.SetDeviceAttribute  ("DataRate", StringValue (bottleneck_bw));
  bottleneckLink.SetChannelAttribute ("Delay",    StringValue (bottleneck_delay));
  bottleneckLink.SetQueue ("ns3::DropTailQueue", "MaxSize", StringValue ("1p"));
  accessLink.SetDeviceAttribute  ("DataRate", StringValue (access_bw));
  accessLink.SetChannelAttribute ("Delay",    StringValue (access_delay));

  // Bottleneck link (shared)
  NetDeviceContainer r0r1 = bottleneckLink.Install (routers.Get (0), routers.Get (1));

  // Access links — SAC flow
  NetDeviceContainer l0r0  = accessLink.Install (leftNodes.Get (0),  routers.Get (0));
  NetDeviceContainer r1rn0 = accessLink.Install (routers.Get (1),    rightNodes.Get (0));

  // Access links — CUBIC flow
  NetDeviceContainer l1r0  = accessLink.Install (leftNodes.Get (1),  routers.Get (0));
  NetDeviceContainer r1rn1 = accessLink.Install (routers.Get (1),    rightNodes.Get (1));

  // ── Internet stack ─────────────────────────────────────────────────────────
  InternetStackHelper internet;
  internet.InstallAll ();

  // Per-node congestion control: SAC for sender 0, CUBIC for sender 1
  leftNodes.Get (0)->GetObject<TcpL4Protocol> ()->SetAttribute (
      "SocketType", TypeIdValue (TcpRlInference::GetTypeId ()));
  leftNodes.Get (1)->GetObject<TcpL4Protocol> ()->SetAttribute (
      "SocketType", TypeIdValue (TypeId::LookupByName ("ns3::TcpCubic")));

  // ── IP addressing ──────────────────────────────────────────────────────────
  Ipv4AddressHelper ipv4;
  ipv4.SetBase ("10.1.1.0", "255.255.255.0");  ipv4.Assign (l0r0);
  ipv4.SetBase ("10.1.2.0", "255.255.255.0");  ipv4.Assign (r0r1);
  ipv4.SetBase ("10.1.3.0", "255.255.255.0");  ipv4.Assign (r1rn0);
  ipv4.SetBase ("10.1.4.0", "255.255.255.0");  ipv4.Assign (l1r0);
  ipv4.SetBase ("10.1.5.0", "255.255.255.0");  ipv4.Assign (r1rn1);
  Ipv4GlobalRoutingHelper::PopulateRoutingTables ();

  // ── Queue discipline on bottleneck ─────────────────────────────────────────
  TrafficControlHelper tchClean;
  tchClean.Uninstall (r0r1);
  TrafficControlHelper tch;
  tch.SetRootQueueDisc ("ns3::FqCoDelQueueDisc", "MaxSize", StringValue ("100p"));
  tch.Install (r0r1);

  // ── Flow 1: SAC (RL-based CC) — port 9 ────────────────────────────────────
  uint16_t sacPort = 9;
  PacketSinkHelper sacSinkHelper ("ns3::TcpSocketFactory",
      InetSocketAddress (Ipv4Address::GetAny (), sacPort));
  ApplicationContainer sacSinkApp = sacSinkHelper.Install (rightNodes.Get (0));
  sacSinkApp.Start (Seconds (0.0));
  sacSinkApp.Stop  (Seconds (simDuration));
  sacSinkApp.Get (0)->TraceConnectWithoutContext (
      "Rx", MakeBoundCallback (&CountRxPkts, 0));

  Ipv4Address sacSinkAddr =
      rightNodes.Get (0)->GetObject<Ipv4> ()->GetAddress (1, 0).GetLocal ();
  BulkSendHelper sacSourceHelper ("ns3::TcpSocketFactory",
      InetSocketAddress (sacSinkAddr, sacPort));
  sacSourceHelper.SetAttribute ("MaxBytes", UintegerValue (0));
  ApplicationContainer sacSourceApp = sacSourceHelper.Install (leftNodes.Get (0));
  sacSourceApp.Start (Seconds (0.1));
  sacSourceApp.Stop  (Seconds (simDuration));

  // ── Flow 2: CUBIC — port 10 ───────────────────────────────────────────────
  uint16_t cubicPort = 10;
  PacketSinkHelper cubicSinkHelper ("ns3::TcpSocketFactory",
      InetSocketAddress (Ipv4Address::GetAny (), cubicPort));
  ApplicationContainer cubicSinkApp = cubicSinkHelper.Install (rightNodes.Get (1));
  cubicSinkApp.Start (Seconds (0.0));
  cubicSinkApp.Stop  (Seconds (simDuration));
  cubicSinkApp.Get (0)->TraceConnectWithoutContext (
      "Rx", MakeBoundCallback (&CountRxPkts, 1));

  Ipv4Address cubicSinkAddr =
      rightNodes.Get (1)->GetObject<Ipv4> ()->GetAddress (1, 0).GetLocal ();
  BulkSendHelper cubicSourceHelper ("ns3::TcpSocketFactory",
      InetSocketAddress (cubicSinkAddr, cubicPort));
  cubicSourceHelper.SetAttribute ("MaxBytes", UintegerValue (0));
  ApplicationContainer cubicSourceApp = cubicSourceHelper.Install (leftNodes.Get (1));
  cubicSourceApp.Start (Seconds (0.1));
  cubicSourceApp.Stop  (Seconds (simDuration));

  // ── CUBIC metric tracing ───────────────────────────────────────────────────
  // PacketSink Rx callback for throughput measurement
  cubicSinkApp.Get (0)->TraceConnectWithoutContext (
      "Rx", MakeCallback (&CubicRxPkt));

  g_cubicTrace.open (cubicTraceFile, std::ios::out | std::ios::trunc);
  g_cubicTrace << "time_s,cwnd,rtt_us,throughput_bps,loss,seg_size,bytes_in_flight\n";
  g_cubicTrace.flush ();

  // Connect CUBIC socket traces after the socket is created (app starts at 0.1s)
  Simulator::Schedule (Seconds (0.5), &ConnectCubicTraces);

  // ── Run ────────────────────────────────────────────────────────────────────
  Simulator::Stop (Seconds (simDuration));
  Simulator::Run ();

  NS_LOG_UNCOND ("[SIM] SAC  rxPkts = " << rxPkts[0]);
  NS_LOG_UNCOND ("[SIM] CUBIC rxPkts = " << rxPkts[1]);

  g_cubicTrace.close ();
  Simulator::Destroy ();
  return 0;
}
