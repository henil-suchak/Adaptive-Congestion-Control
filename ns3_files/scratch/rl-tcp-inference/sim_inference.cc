#include <iostream>
#include <string>

#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/internet-module.h"
#include "ns3/point-to-point-module.h"
#include "ns3/applications-module.h"
#include "ns3/error-model.h"
#include "ns3/tcp-header.h"
#include "ns3/ipv4-global-routing-helper.h"
#include "ns3/traffic-control-module.h"
#include "ns3/ns3-ai-module.h"

#include "tcp-rl-inference.h"

using namespace ns3;

NS_LOG_COMPONENT_DEFINE ("TcpRlInferenceSim");

static std::vector<uint32_t> rxPkts;

static void CountRxPkts (uint32_t sinkId, Ptr<const Packet>, const Address &)
{ rxPkts[sinkId]++; }

int main (int argc, char *argv[])
{
  uint32_t    simDuration      = 200;
  std::string bottleneck_bw    = "2Mbps";
  std::string bottleneck_delay = "20ms";
  std::string access_bw        = "10Mbps";
  std::string access_delay     = "20ms";
  uint32_t    mtu_bytes        = 400;
  // error model disabled for inference

  CommandLine cmd;
  cmd.AddValue ("duration", "Simulation duration (s)", simDuration);
  cmd.Parse (argc, argv);

  // IMPORTANT: Despite the name, TcpL4Protocol::SocketType is the CC TypeId.
  // See tcp-l4-protocol.cc line 84: it maps to m_congestionTypeId.
  // CreateSocket() (line 202) always creates TcpSocketBase, then uses
  // factory.Create<TcpCongestionOps>() with this TypeId to set the CC.
  // DO NOT set this to a TcpSocketBase subclass — it MUST be a TcpCongestionOps.
  Config::SetDefault ("ns3::TcpL4Protocol::SocketType",
                      TypeIdValue (TcpRlInference::GetTypeId ()));
  Config::SetDefault ("ns3::TcpSocket::SegmentSize",  UintegerValue (mtu_bytes - 60));
  Config::SetDefault ("ns3::TcpSocket::DelAckCount",  UintegerValue (1));
  Config::SetDefault ("ns3::TcpSocket::RcvBufSize",   UintegerValue (1 << 21));
  Config::SetDefault ("ns3::TcpSocket::SndBufSize",   UintegerValue (1 << 21));

  NodeContainer routers, leftNodes, rightNodes;
  routers.Create (2);
  leftNodes.Create (1);
  rightNodes.Create (1);
  rxPkts.assign (1, 0);

  PointToPointHelper bottleneckLink, accessLink;
  bottleneckLink.SetDeviceAttribute  ("DataRate", StringValue (bottleneck_bw));
  bottleneckLink.SetChannelAttribute ("Delay",    StringValue (bottleneck_delay));
  bottleneckLink.SetQueue ("ns3::DropTailQueue", "MaxSize", StringValue ("1p"));
  accessLink.SetDeviceAttribute  ("DataRate", StringValue (access_bw));
  accessLink.SetChannelAttribute ("Delay",    StringValue (access_delay));

  NetDeviceContainer r0r1 = bottleneckLink.Install (routers.Get (0), routers.Get (1));
  NetDeviceContainer l0r0 = accessLink.Install (leftNodes.Get (0), routers.Get (0));
  NetDeviceContainer r1rn = accessLink.Install (routers.Get (1), rightNodes.Get (0));

  // Error model disabled for inference (error_p=0.0)
  // Ptr<RateErrorModel> em = CreateObject<RateErrorModel> ();
  // em->SetAttribute ("ErrorRate", DoubleValue (error_p));
  // r0r1.Get (1)->SetAttribute ("ReceiveErrorModel", PointerValue (em));

  InternetStackHelper internet;
  internet.InstallAll ();

  Ipv4AddressHelper ipv4;
  ipv4.SetBase ("10.1.1.0", "255.255.255.0"); ipv4.Assign (l0r0);
  ipv4.SetBase ("10.1.2.0", "255.255.255.0"); ipv4.Assign (r0r1);
  ipv4.SetBase ("10.1.3.0", "255.255.255.0"); ipv4.Assign (r1rn);
  Ipv4GlobalRoutingHelper::PopulateRoutingTables ();

  TrafficControlHelper tchClean;
  tchClean.Uninstall (r0r1);
  TrafficControlHelper tch;
  tch.SetRootQueueDisc ("ns3::FqCoDelQueueDisc", "MaxSize", StringValue ("100p"));
  tch.Install (r0r1);

  uint16_t port = 9;
  PacketSinkHelper sinkHelper ("ns3::TcpSocketFactory",
      InetSocketAddress (Ipv4Address::GetAny (), port));
  ApplicationContainer sinkApp = sinkHelper.Install (rightNodes.Get (0));
  sinkApp.Start (Seconds (0.0));
  sinkApp.Stop  (Seconds (simDuration));
  sinkApp.Get (0)->TraceConnectWithoutContext (
      "Rx", MakeBoundCallback (&CountRxPkts, 0));

  Ipv4Address sinkAddr =
      rightNodes.Get (0)->GetObject<Ipv4> ()->GetAddress (1, 0).GetLocal ();
  BulkSendHelper sourceHelper ("ns3::TcpSocketFactory",
      InetSocketAddress (sinkAddr, port));
  sourceHelper.SetAttribute ("MaxBytes", UintegerValue (0));
  ApplicationContainer sourceApp = sourceHelper.Install (leftNodes.Get (0));
  sourceApp.Start (Seconds (0.1));
  sourceApp.Stop  (Seconds (simDuration));

  Simulator::Stop (Seconds (simDuration));
  Simulator::Run ();
  Simulator::Destroy ();
  return 0;
}
