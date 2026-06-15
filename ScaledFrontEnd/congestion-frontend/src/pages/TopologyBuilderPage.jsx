import { useState, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Background,
  Controls,
  MiniMap,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import RouterNode from '../components/topology/RouterNode';
import SenderNode from '../components/topology/SenderNode';
import ReceiverNode from '../components/topology/ReceiverNode';
import NodePalette from '../components/topology/NodePalette';
import EdgeConfigPanel from '../components/topology/EdgeConfigPanel';
import { TopologyService } from '../services/topologyApi';

/* ── Default dumbbell topology ──────────────────────────────────── */
const defaultNodes = [
  { id: 'sender-1',   type: 'sender',   position: { x: 50,  y: 80 },  data: { label: 'SAC Agent',  algorithm: 'SAC' }},
  { id: 'sender-2',   type: 'sender',   position: { x: 50,  y: 250 }, data: { label: 'CUBIC',      algorithm: 'CUBIC' }},
  { id: 'router-1',   type: 'router',   position: { x: 300, y: 160 }, data: { label: 'Router 0' }},
  { id: 'router-2',   type: 'router',   position: { x: 550, y: 160 }, data: { label: 'Router 1' }},
  { id: 'receiver-1', type: 'receiver', position: { x: 800, y: 80 },  data: { label: 'Sink 1' }},
  { id: 'receiver-2', type: 'receiver', position: { x: 800, y: 250 }, data: { label: 'Sink 2' }},
];

const defaultEdgeData = { bandwidthMbps: 10, delayMs: 20, queueType: 'FqCoDel', queueSize: 100, errorRate: 0 };
const bottleneckEdgeData = { bandwidthMbps: 2, delayMs: 20, queueType: 'FqCoDel', queueSize: 100, errorRate: 0 };

const defaultEdges = [
  { id: 'e-s1-r1', source: 'sender-1',   target: 'router-1',   animated: true, data: { ...defaultEdgeData },
    label: '10 Mbps · 20ms', style: { stroke: '#10b981', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' }},
  { id: 'e-s2-r1', source: 'sender-2',   target: 'router-1',   animated: true, data: { ...defaultEdgeData },
    label: '10 Mbps · 20ms', style: { stroke: '#10b981', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' }},
  { id: 'e-r1-r2', source: 'router-1',   target: 'router-2',   animated: true, data: { ...bottleneckEdgeData },
    label: '⚡ 2 Mbps · 20ms (Bottleneck)', style: { stroke: '#f59e0b', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' }},
  { id: 'e-r2-d1', source: 'router-2',   target: 'receiver-1', animated: true, data: { ...defaultEdgeData },
    label: '10 Mbps · 20ms', style: { stroke: '#f43f5e', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f43f5e' }},
  { id: 'e-r2-d2', source: 'router-2',   target: 'receiver-2', animated: true, data: { ...defaultEdgeData },
    label: '10 Mbps · 20ms', style: { stroke: '#f43f5e', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f43f5e' }},
];

/* ── Helpers ─────────────────────────────────────────────────────── */
let nodeIdCounter = 10;
const getNewId = (type) => `${type}-${nodeIdCounter++}`;

function classifyTopology(nodes) {
  const senders   = nodes.filter((n) => n.type === 'sender');
  const routers   = nodes.filter((n) => n.type === 'router');
  const receivers = nodes.filter((n) => n.type === 'receiver');
  if (routers.length === 2 && senders.length >= 1 && receivers.length >= 1) return 'DUMBBELL';
  return 'CUSTOM';
}

function extractSummary(nodes, edges) {
  const senders   = nodes.filter((n) => n.type === 'sender').length;
  const receivers = nodes.filter((n) => n.type === 'receiver').length;
  // Find bottleneck (lowest bandwidth edge)
  let minBw = Infinity, bnEdge = null;
  edges.forEach((e) => {
    const bw = e.data?.bandwidthMbps || 10;
    if (bw < minBw) { minBw = bw; bnEdge = e; }
  });
  const bottleneckBw    = bnEdge?.data?.bandwidthMbps || 2;
  const bottleneckDelay = bnEdge?.data?.delayMs || 20;
  const queueType       = bnEdge?.data?.queueType || 'FqCoDel';
  // Access links: use the first non-bottleneck edge
  const accessEdge = edges.find((e) => e.id !== bnEdge?.id);
  const accessBw    = accessEdge?.data?.bandwidthMbps || 10;
  const accessDelay = accessEdge?.data?.delayMs || 20;
  // Compute RTT and BDP
  const totalDelayMs = (bottleneckDelay + accessDelay) * 2;
  const bdpBytes = (bottleneckBw * 1e6 / 8) * (totalDelayMs / 1000);
  return { senders, receivers, bottleneckBw, bottleneckDelay, accessBw, accessDelay, queueType, totalDelayMs, bdpBytes };
}

/* ── Page Component ─────────────────────────────────────────────── */
export default function TopologyBuilderPage() {
  const [nodes, setNodes] = useState(defaultNodes);
  const [edges, setEdges] = useState(defaultEdges);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [topoName, setTopoName] = useState('My Dumbbell Topology');
  const [topoDesc, setTopoDesc] = useState('');
  const [savedTopologies, setSavedTopologies] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const nodeTypes = useMemo(() => ({
    router: RouterNode,
    sender: SenderNode,
    receiver: ReceiverNode,
  }), []);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const onConnect = useCallback((connection) => {
    const newEdge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}`,
      animated: true,
      data: { bandwidthMbps: 10, delayMs: 20, queueType: 'FqCoDel', queueSize: 100, errorRate: 0 },
      label: '10 Mbps · 20ms',
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, []);

  const onEdgeClick = useCallback((_, edge) => setSelectedEdge(edge), []);

  const onEdgeUpdate = useCallback((edgeId, newData) => {
    setEdges((eds) => eds.map((e) => {
      if (e.id !== edgeId) return e;
      const label = `${newData.bandwidthMbps} Mbps · ${newData.delayMs}ms`;
      return { ...e, data: newData, label };
    }));
    setSelectedEdge((prev) => prev && prev.id === edgeId ? { ...prev, data: newData } : prev);
  }, []);

  /* ── Drag-and-drop from palette ────────────────────────────────── */
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || !reactFlowInstance) return;

    if (type === 'sender') {
      const currentSenders = nodes.filter(n => n.type === 'sender').length;
      if (currentSenders >= 10) {
        setMessage({ type: 'error', text: 'Maximum limit of 10 senders reached.' });
        return;
      }
    }

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const labels = { sender: 'New Sender', router: 'New Router', receiver: 'New Receiver' };
    const newNode = {
      id: getNewId(type),
      type,
      position,
      data: { label: labels[type] || type, algorithm: type === 'sender' ? 'SAC' : undefined },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [reactFlowInstance, nodes]);

  /* ── Delete key handler ─────────────────────────────────────────── */
  const onKeyDown = useCallback((event) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      setNodes((nds) => nds.filter((n) => !n.selected));
      setEdges((eds) => eds.filter((e) => !e.selected));
      setSelectedEdge(null);
    }
  }, []);

  /* ── Save Topology ──────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!topoName.trim()) { setMessage({ type: 'error', text: 'Please enter a topology name.' }); return; }
    setSaving(true);
    setMessage(null);
    try {
      const topoType = classifyTopology(nodes);
      const summary  = extractSummary(nodes, edges);
      const payload = {
        name: topoName,
        description: topoDesc,
        graphJson: JSON.stringify({ nodes, edges }),
        bottleneckBandwidthMbps: summary.bottleneckBw,
        bottleneckDelayMs: summary.bottleneckDelay,
        accessBandwidthMbps: summary.accessBw,
        accessDelayMs: summary.accessDelay,
        queueType: summary.queueType,
        numSenders: summary.senders,
        numReceivers: summary.receivers,
        errorRate: 0,
        topologyType: topoType,
      };
      await TopologyService.create(payload);
      setMessage({ type: 'success', text: `Topology "${topoName}" saved!` });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data || 'Failed to save topology.' });
    } finally {
      setSaving(false);
    }
  };

  /* ── Load Saved Topologies ──────────────────────────────────────── */
  const handleLoadList = async () => {
    try {
      const list = await TopologyService.getAll();
      setSavedTopologies(list);
      setShowSaved(true);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load topologies.' });
    }
  };

  const handleLoadTopology = (topo) => {
    const graph = JSON.parse(topo.graphJson);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setTopoName(topo.name);
    setTopoDesc(topo.description || '');
    setShowSaved(false);
    setMessage({ type: 'success', text: `Loaded "${topo.name}".` });
  };

  /* ── Auto-layout (reset to default dumbbell) ───────────────────── */
  const handleAutoLayout = () => {
    setNodes(defaultNodes);
    setEdges(defaultEdges);
    setTopoName('My Dumbbell Topology');
    setMessage({ type: 'success', text: 'Reset to default dumbbell topology.' });
  };

  /* ── Stats ──────────────────────────────────────────────────────── */
  const topoType = classifyTopology(nodes);
  const summary  = extractSummary(nodes, edges);

  return (
    <div className="flex flex-col h-[calc(100vh-72px)]" onKeyDown={onKeyDown} tabIndex={0}>
      {/* ── Top Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={topoName}
            onChange={(e) => setTopoName(e.target.value)}
            placeholder="Topology Name"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
            topoType === 'DUMBBELL'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {topoType === 'DUMBBELL' ? '✅ Dumbbell (Supported)' : '✅ Custom (Supported)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleAutoLayout}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition">
            🔄 Auto Layout
          </button>
          <button onClick={handleLoadList}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition">
            📂 Load
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50">
            {saving ? '⏳ Saving...' : '💾 Save Topology'}
          </button>
        </div>
      </div>

      {/* ── Message banner ─────────────────────────────────────────── */}
      {message && (
        <div className={`px-4 py-2 text-sm font-medium shrink-0 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-3 text-xs underline">dismiss</button>
        </div>
      )}

      {/* ── Main Content ───────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — Node Palette */}
        <NodePalette />

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e2e8f0" gap={20} />
            <Controls position="bottom-right" />
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor={(n) => {
                if (n.type === 'sender')   return '#10b981';
                if (n.type === 'router')   return '#6366f1';
                if (n.type === 'receiver') return '#f43f5e';
                return '#94a3b8';
              }}
              position="bottom-left"
            />
          </ReactFlow>
        </div>

        {/* Right Sidebar — Edge Config */}
        {selectedEdge && (
          <EdgeConfigPanel
            edge={selectedEdge}
            onUpdate={onEdgeUpdate}
            onClose={() => setSelectedEdge(null)}
          />
        )}
      </div>

      {/* ── Bottom Bar — Summary ───────────────────────────────────── */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-6 text-xs text-gray-600 shrink-0">
        <span>📊 <strong>{nodes.length}</strong> nodes</span>
        <span>🔗 <strong>{edges.length}</strong> links</span>
        <span>⚡ Bottleneck: <strong>{summary.bottleneckBw} Mbps</strong></span>
        <span>⏱️ Min RTT: <strong>{summary.totalDelayMs.toFixed(1)} ms</strong></span>
        <span>📦 BDP: <strong>{(summary.bdpBytes / 1000).toFixed(1)} KB</strong></span>
        <span>📤 Senders: <strong>{summary.senders}</strong></span>
        <span>📥 Receivers: <strong>{summary.receivers}</strong></span>
      </div>

      {/* ── Saved Topologies Modal ─────────────────────────────────── */}
      {showSaved && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
             onClick={() => setShowSaved(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[70vh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">📂 Saved Topologies</h3>
              <button onClick={() => setShowSaved(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="p-4 space-y-2">
              {savedTopologies.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No saved topologies yet.</p>
              ) : (
                savedTopologies.map((t) => (
                  <div key={t.id}
                    onClick={() => handleLoadTopology(t)}
                    className="p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        t.topologyType === 'DUMBBELL' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>{t.topologyType}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {t.bottleneckBandwidthMbps} Mbps · {t.bottleneckDelayMs}ms · {t.queueType}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
