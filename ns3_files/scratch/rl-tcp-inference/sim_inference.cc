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

#include "tcp-rl-inference.h"
#include "json.hpp" // nlohmann json

using namespace ns3;
using json = nlohmann::json;

NS_LOG_COMPONENT_DEFINE ("TcpRlInferenceSim");

static std::vector<uint32_t> rxPkts;

static void CountRxPkts (uint32_t sinkId, Ptr<const Packet>, const Address &)
{ rxPkts[sinkId]++; }

static std::ofstream g_cubicTrace;
static uint32_t  g_cubicCwnd          = 0;
static double    g_cubicRttUs         = 0.0;
static uint32_t  g_cubicLossCount     = 0;
static uint64_t  g_cubicRxBytes       = 0;
static uint64_t  g_cubicRxBytesPrev   = 0;
static uint32_t  g_cubicSegSize       = 340;
static uint32_t  g_cubicBytesInFlight = 0;

static void CubicCwndChanged (uint32_t, uint32_t newVal) { g_cubicCwnd = newVal; }
static void CubicRttChanged (Time, Time newVal) { g_cubicRttUs = newVal.GetMicroSeconds (); }
static void CubicCongStateChanged (TcpSocketState::TcpCongState_t, TcpSocketState::TcpCongState_t newState)
{ if (newState == TcpSocketState::CA_LOSS) g_cubicLossCount++; }
static void CubicBytesInFlightChanged (uint32_t, uint32_t newVal) { g_cubicBytesInFlight = newVal; }
static void CubicRxPkt (Ptr<const Packet> p, const Address &) { g_cubicRxBytes += p->GetSize (); }

static void WriteCubicMetrics ()
{
  double now_s      = Simulator::Now ().GetSeconds ();
  double interval_s = 0.1;
  double deltaBytes = (double)(g_cubicRxBytes - g_cubicRxBytesPrev);
  double tputBps    = deltaBytes * 8.0 / interval_s;
  g_cubicRxBytesPrev = g_cubicRxBytes;

  g_cubicTrace << now_s << "," << g_cubicCwnd << "," << g_cubicRttUs << "," << tputBps << ","
               << g_cubicLossCount << "," << g_cubicSegSize << "," << g_cubicBytesInFlight << "\n";
  g_cubicTrace.flush ();
  g_cubicLossCount = 0;

  if (Simulator::Now () + MilliSeconds (100) < Simulator::GetMaximumSimulationTime ())
    Simulator::Schedule (MilliSeconds (100), &WriteCubicMetrics);
}

// Global vectors to hold dynamically created apps
static std::vector<ApplicationContainer> sinkApps;
static std::vector<ApplicationContainer> sourceApps;

// We will track the node that CUBIC runs on (if any) to attach traces
static Ptr<Node> g_cubicNode = nullptr;

static void ConnectCubicTraces ()
{
  if (!g_cubicNode) return;
  uint32_t nodeId = g_cubicNode->GetId();
  std::string cwndPath = "/NodeList/" + std::to_string(nodeId) + "/$ns3::TcpL4Protocol/SocketList/0/CongestionWindow";
  std::string rttPath = "/NodeList/" + std::to_string(nodeId) + "/$ns3::TcpL4Protocol/SocketList/0/RTT";
  std::string congStatePath = "/NodeList/" + std::to_string(nodeId) + "/$ns3::TcpL4Protocol/SocketList/0/CongState";
  std::string bifPath = "/NodeList/" + std::to_string(nodeId) + "/$ns3::TcpL4Protocol/SocketList/0/BytesInFlight";

  Config::ConnectWithoutContext (cwndPath, MakeCallback (&CubicCwndChanged));
  Config::ConnectWithoutContext (rttPath, MakeCallback (&CubicRttChanged));
  Config::ConnectWithoutContext (congStatePath, MakeCallback (&CubicCongStateChanged));
  Config::ConnectWithoutContext (bifPath, MakeCallback (&CubicBytesInFlightChanged));

  NS_LOG_UNCOND ("[CUBIC] Trace callbacks connected at t=" << Simulator::Now ().GetSeconds () << "s for Node " << nodeId);
  Simulator::Schedule (MilliSeconds (100), &WriteCubicMetrics);
}

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

  leftNodes.Get (0)->GetObject<TcpL4Protocol> ()->SetAttribute ("SocketType", TypeIdValue (TcpRlInference::GetTypeId ()));
  leftNodes.Get (1)->GetObject<TcpL4Protocol> ()->SetAttribute ("SocketType", TypeIdValue (TypeId::LookupByName ("ns3::TcpCubic")));

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
  cubicSinkApp.Get (0)->TraceConnectWithoutContext ("Rx", MakeCallback (&CubicRxPkt));
  sinkApps.push_back(cubicSinkApp);

  Ipv4Address cubicSinkAddr = rightNodes.Get (1)->GetObject<Ipv4> ()->GetAddress (1, 0).GetLocal ();
  BulkSendHelper cubicSourceHelper ("ns3::TcpSocketFactory", InetSocketAddress (cubicSinkAddr, cubicPort));
  cubicSourceHelper.SetAttribute ("MaxBytes", UintegerValue (0));
  ApplicationContainer cubicSourceApp = cubicSourceHelper.Install (leftNodes.Get (1));
  cubicSourceApp.Start (Seconds (0.1));
  cubicSourceApp.Stop  (Seconds (simDuration));
  sourceApps.push_back(cubicSourceApp);

  g_cubicNode = leftNodes.Get(1);
}

// ── Custom JSON Topology Parser ──────────────────────────────────────────────
void BuildCustomTopology (const json& graph, uint32_t simDuration)
{
  NS_LOG_UNCOND ("Building CUSTOM JSON topology...");
  std::map<std::string, Ptr<Node>> nodeMap;
  std::map<std::string, std::string> nodeTypes;
  std::vector<std::string> senderIds;
  std::vector<std::string> receiverIds;

  // 1. Create Nodes
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

  // 2. Install Internet Stack
  InternetStackHelper internet;
  for (auto const& [id, n] : nodeMap) {
    internet.Install (n);
    
    // Set SocketType based on node type
    if (nodeTypes[id] == "sacSender") {
      n->GetObject<TcpL4Protocol> ()->SetAttribute ("SocketType", TypeIdValue (TcpRlInference::GetTypeId ()));
    } else if (nodeTypes[id] == "cubicSender") {
      n->GetObject<TcpL4Protocol> ()->SetAttribute ("SocketType", TypeIdValue (TypeId::LookupByName ("ns3::TcpCubic")));
      g_cubicNode = n; // Track cubic node for traces
    }
  }

  // 3. Create Edges (PointToPoint Links)
  Ipv4AddressHelper ipv4;
  uint32_t subnet = 1;
  TrafficControlHelper tch;

  std::map<std::string, NetDeviceContainer> edgeDevices;

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
    
    // Handle queue discipline
    if (qType == "FqCoDel") {
      p2p.SetQueue ("ns3::DropTailQueue", "MaxSize", StringValue ("100p")); // Minimal hw queue
    } else {
      p2p.SetQueue ("ns3::DropTailQueue", "MaxSize", StringValue ("100p"));
    }

    NetDeviceContainer d = p2p.Install (nodeMap[srcId], nodeMap[dstId]);
    
    // Setup traffic control if FqCoDel
    if (qType == "FqCoDel") {
      TrafficControlHelper tchFq;
      tchFq.SetRootQueueDisc ("ns3::FqCoDelQueueDisc", "MaxSize", StringValue ("100p"));
      tchFq.Install (d);
    }

    // Assign IP
    std::string baseIp = "10.1." + std::to_string(subnet) + ".0";
    ipv4.SetBase (baseIp.c_str(), "255.255.255.0");
    ipv4.Assign (d);
    subnet++;
  }

  Ipv4GlobalRoutingHelper::PopulateRoutingTables ();

  // 4. Setup Applications (Flows)
  // We'll map senders to receivers round-robin or randomly
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
    
    // Pick a receiver
    std::string rId = receiverIds[i % receiverIds.size()];
    
    BulkSendHelper sourceHelper ("ns3::TcpSocketFactory", InetSocketAddress (recvAddrs[rId], port));
    sourceHelper.SetAttribute ("MaxBytes", UintegerValue (0));
    ApplicationContainer sourceApp = sourceHelper.Install (sNode);
    sourceApp.Start (Seconds (0.1));
    sourceApp.Stop  (Seconds (simDuration));
    sourceApps.push_back(sourceApp);

    if (nodeTypes[sId] == "cubicSender") {
      // Find the corresponding sink to track throughput
      // It's the `i % receiverIds.size()` sink
      sinkApps[i % receiverIds.size()].Get(0)->TraceConnectWithoutContext ("Rx", MakeCallback (&CubicRxPkt));
    }
  }
}

int main (int argc, char *argv[])
{
  const char* shmEnv = std::getenv("NS3_SHM_ID");
  uint32_t shmKey = shmEnv ? (uint32_t)std::atoi(shmEnv) : 2334;
  GlobalValue::Bind ("SharedMemoryKey", UintegerValue (shmKey));

  uint32_t    simDuration      = 200;
  std::string bottleneck_bw    = "2Mbps";
  std::string bottleneck_delay = "20ms";
  std::string access_bw        = "10Mbps";
  std::string access_delay     = "20ms";
  uint32_t    mtu_bytes        = 400;
  std::string cubicTraceFile   = "/tmp/cubic_metrics.csv";
  std::string topologyFile     = "";

  CommandLine cmd;
  cmd.AddValue ("duration",   "Simulation duration (s)",   simDuration);
  cmd.AddValue ("cubicTrace", "CUBIC metrics output file", cubicTraceFile);
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
  g_cubicSegSize = mtu_bytes - 60;

  g_cubicTrace.open (cubicTraceFile, std::ios::out | std::ios::trunc);
  g_cubicTrace << "time_s,cwnd,rtt_us,throughput_bps,loss,seg_size,bytes_in_flight\n";
  g_cubicTrace.flush ();

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

  Simulator::Schedule (Seconds (0.5), &ConnectCubicTraces);

  Simulator::Stop (Seconds (simDuration));
  Simulator::Run ();

  for (size_t i = 0; i < rxPkts.size(); ++i) {
    NS_LOG_UNCOND ("[SIM] Sink " << i << " rxPkts = " << rxPkts[i]);
  }

  g_cubicTrace.close ();
  Simulator::Destroy ();
  return 0;
}
