#include <iostream>
#include <fstream>
#include <string>
#include <cstdlib>
#include <map>

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

#include "tcp-rl.h"
#include "tcp-rl-env.h"
#include "json.hpp" // nlohmann json

using namespace ns3;
using json = nlohmann::json;

NS_LOG_COMPONENT_DEFINE ("TcpRlSim");

static std::vector<uint32_t> rxPkts;

static void CountRxPkts (uint32_t sinkId, Ptr<const Packet>, const Address &)
{ rxPkts[sinkId]++; }

static std::vector<ApplicationContainer> sinkApps;
static std::vector<ApplicationContainer> sourceApps;

// ── Default Dumbbell Topology Fallback ───────────────────────────────────────
void BuildDefaultDumbbell (uint32_t simDuration, const std::string& bottleneck_bw, const std::string& bottleneck_delay,
                           const std::string& access_bw, const std::string& access_delay, uint32_t mtu_bytes)
{
  NS_LOG_UNCOND ("Building DEFAULT DUMBBELL topology...");
  NodeContainer routers, leftNodes, rightNodes;
  routers.Create (2);
  leftNodes.Create (2);
  rightNodes.Create (2);
  rxPkts.assign (2, 0);

  PointToPointHelper bottleneckLink, accessLink;
  bottleneckLink.SetDeviceAttribute  ("DataRate", StringValue (bottleneck_bw));
  bottleneckLink.SetChannelAttribute ("Delay",    StringValue (bottleneck_delay));
  bottleneckLink.SetQueue ("ns3::DropTailQueue", "MaxSize", StringValue ("100p"));
  accessLink.SetDeviceAttribute  ("DataRate", StringValue (access_bw));
  accessLink.SetChannelAttribute ("Delay",    StringValue (access_delay));

  NetDeviceContainer r0r1  = bottleneckLink.Install (routers.Get (0), routers.Get (1));
  NetDeviceContainer l0r0  = accessLink.Install (leftNodes.Get (0),  routers.Get (0));
  NetDeviceContainer r1rn0 = accessLink.Install (routers.Get (1),    rightNodes.Get (0));
  NetDeviceContainer l1r0  = accessLink.Install (leftNodes.Get (1),  routers.Get (0));
  NetDeviceContainer r1rn1 = accessLink.Install (routers.Get (1),    rightNodes.Get (1));

  InternetStackHelper internet;
  internet.InstallAll ();

  leftNodes.Get (0)->GetObject<TcpL4Protocol> ()->SetAttribute ("SocketType", TypeIdValue (TypeId::LookupByName("ns3::TcpRlTimeBased")));
  leftNodes.Get (1)->GetObject<TcpL4Protocol> ()->SetAttribute ("SocketType", TypeIdValue (TypeId::LookupByName("ns3::TcpCubic")));

  Ipv4AddressHelper ipv4;
  ipv4.SetBase ("10.1.1.0", "255.255.255.0"); ipv4.Assign (l0r0);
  ipv4.SetBase ("10.1.2.0", "255.255.255.0"); ipv4.Assign (r0r1);
  ipv4.SetBase ("10.1.3.0", "255.255.255.0"); ipv4.Assign (r1rn0);
  ipv4.SetBase ("10.1.4.0", "255.255.255.0"); ipv4.Assign (l1r0);
  ipv4.SetBase ("10.1.5.0", "255.255.255.0"); ipv4.Assign (r1rn1);
  Ipv4GlobalRoutingHelper::PopulateRoutingTables ();

  TrafficControlHelper tchClean;
  tchClean.Uninstall (r0r1);
  TrafficControlHelper tch;
  tch.SetRootQueueDisc ("ns3::FqCoDelQueueDisc", "MaxSize", StringValue ("100p"));
  tch.Install (r0r1);

  // SAC Sender/Receiver
  uint16_t sacPort = 9;
  PacketSinkHelper sacSinkHelper ("ns3::TcpSocketFactory", InetSocketAddress (Ipv4Address::GetAny (), sacPort));
  ApplicationContainer sacSinkApp = sacSinkHelper.Install (rightNodes.Get (0));
  sacSinkApp.Start (Seconds (0.0));
  sacSinkApp.Stop  (Seconds (simDuration));
  sacSinkApp.Get (0)->TraceConnectWithoutContext ("Rx", MakeBoundCallback (&CountRxPkts, 0));
  sinkApps.push_back(sacSinkApp);

  Ipv4Address sacSinkAddr = rightNodes.Get (0)->GetObject<Ipv4> ()->GetAddress (1, 0).GetLocal ();
  BulkSendHelper sacSourceHelper ("ns3::TcpSocketFactory", InetSocketAddress (sacSinkAddr, sacPort));
  sacSourceHelper.SetAttribute ("MaxBytes", UintegerValue (0));
  ApplicationContainer sacSourceApp = sacSourceHelper.Install (leftNodes.Get (0));
  sacSourceApp.Start (Seconds (0.1));
  sacSourceApp.Stop  (Seconds (simDuration));
  sourceApps.push_back(sacSourceApp);

  // CUBIC Sender/Receiver
  uint16_t cubicPort = 10;
  PacketSinkHelper cubicSinkHelper ("ns3::TcpSocketFactory", InetSocketAddress (Ipv4Address::GetAny (), cubicPort));
  ApplicationContainer cubicSinkApp = cubicSinkHelper.Install (rightNodes.Get (1));
  cubicSinkApp.Start (Seconds (0.0));
  cubicSinkApp.Stop  (Seconds (simDuration));
  cubicSinkApp.Get (0)->TraceConnectWithoutContext ("Rx", MakeBoundCallback (&CountRxPkts, 1));
  sinkApps.push_back(cubicSinkApp);

  Ipv4Address cubicSinkAddr = rightNodes.Get (1)->GetObject<Ipv4> ()->GetAddress (1, 0).GetLocal ();
  BulkSendHelper cubicSourceHelper ("ns3::TcpSocketFactory", InetSocketAddress (cubicSinkAddr, cubicPort));
  cubicSourceHelper.SetAttribute ("MaxBytes", UintegerValue (0));
  ApplicationContainer cubicSourceApp = cubicSourceHelper.Install (leftNodes.Get (1));
  cubicSourceApp.Start (Seconds (0.1));
  cubicSourceApp.Stop  (Seconds (simDuration));
  sourceApps.push_back(cubicSourceApp);
}

// ── Custom JSON Topology Parser ──────────────────────────────────────────────
void BuildCustomTopology (const json& graph, uint32_t simDuration)
{
  NS_LOG_UNCOND ("Building CUSTOM JSON topology...");
  std::map<std::string, Ptr<Node>> nodeMap;
  std::map<std::string, std::string> nodeTypes;
  std::vector<std::string> senderIds;
  std::vector<std::string> receiverIds;

  for (const auto& jNode : graph["nodes"]) {
    std::string id = jNode["id"];
    std::string type = jNode["type"]; // "senderNode", "receiverNode", "routerNode"
    
    std::string actualType = type;
    if (type == "sender" || type == "senderNode") {
      if (jNode.contains("data") && jNode["data"].contains("algorithm")) {
        std::string algo = jNode["data"]["algorithm"];
        if (algo == "SAC") actualType = "sacSender";
        else if (algo == "CUBIC") actualType = "cubicSender";
        else actualType = "cubicSender"; // default
      } else {
        actualType = "sacSender"; // default if not specified
      }
    } else if (type == "receiver" || type == "receiverNode") {
        actualType = "receiver";
    }

    Ptr<Node> n = CreateObject<Node> ();
    nodeMap[id] = n;
    nodeTypes[id] = actualType;

    if (actualType == "sacSender" || actualType == "cubicSender") {
      senderIds.push_back(id);
    } else if (actualType == "receiver") {
      receiverIds.push_back(id);
    }
  }

  InternetStackHelper internet;
  for (auto const& [id, n] : nodeMap) {
    internet.Install (n);
    if (nodeTypes[id] == "sacSender") {
      n->GetObject<TcpL4Protocol> ()->SetAttribute ("SocketType", TypeIdValue (TypeId::LookupByName("ns3::TcpRlTimeBased")));
    } else if (nodeTypes[id] == "cubicSender") {
      n->GetObject<TcpL4Protocol> ()->SetAttribute ("SocketType", TypeIdValue (TypeId::LookupByName("ns3::TcpCubic")));
    }
  }

  Ipv4AddressHelper ipv4;
  uint32_t subnet = 1;

  for (const auto& jEdge : graph["edges"]) {
    std::string srcId = jEdge["source"];
    std::string dstId = jEdge["target"];
    std::string bw = "10Mbps";
    std::string delay = "10ms";
    std::string qType = "DropTailQueue";
    
    if (jEdge.contains("data")) {
      auto data = jEdge["data"];
      if (data.contains("bandwidthMbps")) {
        if (data["bandwidthMbps"].is_number()) bw = std::to_string(data["bandwidthMbps"].get<int>()) + "Mbps";
        else bw = data["bandwidthMbps"].get<std::string>() + "Mbps";
      } else if (data.contains("bandwidth")) {
        bw = data["bandwidth"];
      }

      if (data.contains("delayMs")) {
        if (data["delayMs"].is_number()) delay = std::to_string(data["delayMs"].get<int>()) + "ms";
        else delay = data["delayMs"].get<std::string>() + "ms";
      } else if (data.contains("delay")) {
        delay = data["delay"];
      }

      if (data.contains("queueType")) qType = data["queueType"];
    }

    PointToPointHelper p2p;
    p2p.SetDeviceAttribute  ("DataRate", StringValue (bw));
    p2p.SetChannelAttribute ("Delay",    StringValue (delay));
    p2p.SetQueue ("ns3::DropTailQueue", "MaxSize", StringValue ("100p"));

    NetDeviceContainer d = p2p.Install (nodeMap[srcId], nodeMap[dstId]);
    
    if (qType == "FqCoDel") {
      TrafficControlHelper tchFq;
      tchFq.SetRootQueueDisc ("ns3::FqCoDelQueueDisc", "MaxSize", StringValue ("100p"));
      tchFq.Install (d);
    }

    std::string baseIp = "10.1." + std::to_string(subnet) + ".0";
    ipv4.SetBase (baseIp.c_str(), "255.255.255.0");
    ipv4.Assign (d);
    subnet++;
  }

  Ipv4GlobalRoutingHelper::PopulateRoutingTables ();

  rxPkts.assign (receiverIds.size(), 0);
  
  uint16_t port = 9;
  std::map<std::string, Ipv4Address> recvAddrs;
  
  for (size_t i = 0; i < receiverIds.size(); ++i) {
    std::string rId = receiverIds[i];
    Ptr<Node> rNode = nodeMap[rId];
    
    PacketSinkHelper sinkHelper ("ns3::TcpSocketFactory", InetSocketAddress (Ipv4Address::GetAny (), port));
    ApplicationContainer sinkApp = sinkHelper.Install (rNode);
    sinkApp.Start (Seconds (0.0));
    sinkApp.Stop  (Seconds (simDuration));
    sinkApp.Get (0)->TraceConnectWithoutContext ("Rx", MakeBoundCallback (&CountRxPkts, i));
    sinkApps.push_back(sinkApp);
    
    recvAddrs[rId] = rNode->GetObject<Ipv4> ()->GetAddress (1, 0).GetLocal ();
  }

  for (size_t i = 0; i < senderIds.size(); ++i) {
    std::string sId = senderIds[i];
    Ptr<Node> sNode = nodeMap[sId];
    std::string rId = receiverIds[i % receiverIds.size()];
    
    BulkSendHelper sourceHelper ("ns3::TcpSocketFactory", InetSocketAddress (recvAddrs[rId], port));
    sourceHelper.SetAttribute ("MaxBytes", UintegerValue (0));
    ApplicationContainer sourceApp = sourceHelper.Install (sNode);
    sourceApp.Start (Seconds (0.1));
    sourceApp.Stop  (Seconds (simDuration - 3));
    sourceApps.push_back(sourceApp);
  }
}

int main (int argc, char *argv[])
{
  const char *shmEnv = std::getenv ("NS3_SHM_ID");
  uint32_t shmKey = shmEnv ? (uint32_t) std::atoi (shmEnv) : 1234;
  GlobalValue::Bind ("SharedMemoryKey", UintegerValue (shmKey));
  GlobalValue::Bind ("SharedMemoryPoolSize", UintegerValue (1048576));

  uint32_t    simDuration      = 200;
  std::string bottleneck_bw    = "2Mbps";
  std::string bottleneck_delay = "20ms";
  std::string access_bw        = "10Mbps";
  std::string access_delay     = "20ms";
  uint32_t    mtu_bytes        = 400;
  std::string topologyFile     = "";

  CommandLine cmd;
  cmd.AddValue ("duration",   "Simulation duration (s)",   simDuration);
  cmd.AddValue ("bottleneckBw",    "Bottleneck bandwidth",    bottleneck_bw);
  cmd.AddValue ("bottleneckDelay", "Bottleneck delay",        bottleneck_delay);
  cmd.AddValue ("accessBw",        "Access link bandwidth",   access_bw);
  cmd.AddValue ("accessDelay",     "Access link delay",       access_delay);
  cmd.AddValue ("mtu",             "MTU in bytes",            mtu_bytes);
  cmd.AddValue ("topologyFile",    "Path to graph JSON file", topologyFile);
  cmd.Parse (argc, argv);

  Config::SetDefault ("ns3::TcpSocket::SegmentSize", UintegerValue (mtu_bytes - 60));
  Config::SetDefault ("ns3::TcpSocket::DelAckCount", UintegerValue (1));
  Config::SetDefault ("ns3::TcpSocket::RcvBufSize",  UintegerValue (1 << 21));
  Config::SetDefault ("ns3::TcpSocket::SndBufSize",  UintegerValue (1 << 21));

  DataRate dr (bottleneck_bw);
  TcpTimeStepEnv::s_bottleneckBps = dr.GetBitRate ();

  bool builtCustom = false;
  if (!topologyFile.empty()) {
    std::ifstream f(topologyFile);
    if (f.is_open()) {
      try {
        json graph = json::parse(f);
        if (graph.contains("nodes") && graph.contains("edges")) {
          BuildCustomTopology(graph, simDuration);
          builtCustom = true;
        } else {
          NS_LOG_UNCOND("JSON does not contain nodes and edges. Falling back to default.");
        }
      } catch (json::parse_error& e) {
        NS_LOG_UNCOND("JSON parse error: " << e.what() << ". Falling back to default.");
      }
    } else {
      NS_LOG_UNCOND("Could not open topologyFile " << topologyFile << ". Falling back to default.");
    }
  }

  if (!builtCustom) {
    BuildDefaultDumbbell(simDuration, bottleneck_bw, bottleneck_delay, access_bw, access_delay, mtu_bytes);
  }

  Simulator::Stop (Seconds (simDuration));
  Simulator::Run ();

  for (size_t i = 0; i < rxPkts.size(); ++i) {
    NS_LOG_UNCOND ("[SIM] Sink " << i << " rxPkts = " << rxPkts[i]);
  }

  RlCentralController::Get().NotifyGameOver();

  Simulator::Destroy ();
  return 0;
}
