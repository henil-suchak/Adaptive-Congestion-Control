import React from 'react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts';
import { useMetricsWebSocket } from '../hooks/useMetricsWebSocket';

/* ── Reusable Chart Component ─────────────────────────────────────────── */

function MetricChart({ data, dataKey, color, label, unit, domain, refLine, gradient }) {
  const gradientId = `gradient-${dataKey}`;
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors">
      <h3 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">
        {label}
      </h3>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fill: '#6b7280' }}
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={{ stroke: '#1f2937' }}
          />
          <YAxis
            domain={domain || ['auto', 'auto']}
            tick={{ fontSize: 9, fill: '#6b7280' }}
            width={45}
            unit={unit}
            tickLine={false}
            axisLine={{ stroke: '#1f2937' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            labelStyle={{ color: '#9ca3af' }}
          />
          {refLine && (
            <ReferenceLine
              y={refLine.value}
              stroke={refLine.color}
              strokeDasharray="5 5"
              label={{
                value: refLine.label,
                fill: refLine.color,
                fontSize: 9,
                position: 'right'
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Stats Panel ──────────────────────────────────────────────────────── */

function StatsPanel({ current, metrics, stepCount }) {
  if (!current) {
    return (
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-gray-800 flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Waiting for data...</p>
          <p className="text-gray-600 text-xs mt-1">Start the inference pipeline</p>
        </div>
      </div>
    );
  }

  const avgRtt = metrics.length > 0
    ? (metrics.reduce((s, m) => s + (m.rtt || 0), 0) / metrics.length).toFixed(2) : 0;
  const avgTput = metrics.length > 0
    ? (metrics.reduce((s, m) => s + (m.throughput || 0), 0) / metrics.length).toFixed(4) : 0;
  const avgReward = metrics.length > 0
    ? (metrics.reduce((s, m) => s + (m.reward || 0), 0) / metrics.length).toFixed(4) : 0;

  const action = current.action || 1.0;
  let actionLabel, actionColor;
  if (action >= 1.15)      { actionLabel = '▲▲ GROW FAST'; actionColor = 'text-emerald-400'; }
  else if (action >= 1.05) { actionLabel = '▲  GROW';      actionColor = 'text-emerald-300'; }
  else if (action >= 0.95) { actionLabel = '── HOLD';      actionColor = 'text-yellow-400'; }
  else if (action >= 0.85) { actionLabel = '▼  SHRINK';    actionColor = 'text-red-300'; }
  else                     { actionLabel = '▼▼ SHRINK';    actionColor = 'text-red-400'; }

  const reward = current.reward || 0;
  let rewardLabel, rewardColor;
  if (reward >= 0.7)       { rewardLabel = 'GREAT'; rewardColor = 'text-emerald-400'; }
  else if (reward >= 0.4)  { rewardLabel = 'GOOD';  rewardColor = 'text-blue-400'; }
  else if (reward >= 0.1)  { rewardLabel = 'OK';    rewardColor = 'text-yellow-400'; }
  else if (reward >= 0)    { rewardLabel = 'LOW';   rewardColor = 'text-gray-400'; }
  else                     { rewardLabel = 'BAD';   rewardColor = 'text-red-400'; }

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-5 border border-gray-800 space-y-4">
      <h3 className="text-white font-semibold text-sm uppercase tracking-wider">
        Current State
      </h3>

      {/* Metric Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="RTT" value={`${(current.rttMs || 0).toFixed(2)}`} unit="ms" color="text-blue-400" />
        <StatCard label="Throughput" value={`${(current.throughputMbps || 0).toFixed(4)}`} unit="Mbps" color="text-emerald-400" />
        <StatCard label="cWnd" value={`${Math.round(current.cwndBytes || 0).toLocaleString()}`} unit="B" color="text-violet-400" />
        <StatCard label="Pkt Loss" value={`${((current.packetLossRate || 0) * 100).toFixed(2)}`} unit="%" color="text-amber-400" />
      </div>

      {/* Agent Decision */}
      <div className="border-t border-gray-800 pt-3">
        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Agent Action</p>
        <p className={`font-mono font-bold text-lg ${actionColor}`}>{actionLabel}</p>
        <p className="text-gray-600 text-xs mt-1">factor: {action.toFixed(4)}</p>
      </div>

      {/* Reward */}
      <div className="border-t border-gray-800 pt-3">
        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Reward</p>
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold text-lg ${rewardColor}`}>
            {reward >= 0 ? '+' : ''}{reward.toFixed(4)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${rewardColor} border-current opacity-70`}>
            {rewardLabel}
          </span>
        </div>
      </div>

      {/* Rolling Averages */}
      <div className="border-t border-gray-800 pt-3">
        <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
          Rolling Avg <span className="text-gray-600">(last {metrics.length})</span>
        </p>
        <div className="space-y-1 text-xs">
          <AvgRow label="Avg RTT" value={`${avgRtt} ms`} />
          <AvgRow label="Avg Tput" value={`${avgTput} Mbps`} />
          <AvgRow label="Avg Reward" value={avgReward} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color }) {
  return (
    <div className="bg-gray-950/60 rounded-lg p-2.5">
      <p className="text-gray-500 text-[10px] uppercase tracking-wider">{label}</p>
      <p className={`font-mono text-sm font-semibold ${color}`}>
        {value} <span className="text-gray-600 text-xs">{unit}</span>
      </p>
    </div>
  );
}

function AvgRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 font-mono">{value}</span>
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────────────────────────────── */

export default function Dashboard() {
  const { metrics, current, connected, stepCount } = useMetricsWebSocket();

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
            SAC TCP Congestion Control
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Live Inference Dashboard — ns-3 Simulation
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          <div className="bg-gray-900 rounded-lg px-3 py-1.5 border border-gray-800">
            <span className="text-xs text-gray-500">Steps </span>
            <span className="text-xs text-white font-mono">{stepCount}</span>
          </div>
        </div>
      </div>

      {/* Main grid: 3 cols charts + 1 col stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3 space-y-4">
          <MetricChart
            data={metrics} dataKey="rtt" color="#60a5fa"
            label="Round Trip Time (RTT)" unit=" ms"
            domain={[0, 300]}
            refLine={{ value: 80, color: '#10b981', label: 'min RTT' }}
          />
          <MetricChart
            data={metrics} dataKey="throughput" color="#34d399"
            label="Throughput" unit=" Mbps"
            domain={[0, 2]}
            refLine={{ value: 2.0, color: '#f59e0b', label: '2 Mbps' }}
          />
          <MetricChart
            data={metrics} dataKey="cwnd" color="#a78bfa"
            label="Congestion Window (cWnd)" unit=" KB"
          />
          <MetricChart
            data={metrics} dataKey="reward" color="#f87171"
            label="Agent Reward" unit=""
            domain={[-2, 1.1]}
            refLine={{ value: 0, color: '#4b5563', label: '' }}
          />
        </div>

        <div className="col-span-1">
          <StatsPanel current={current} metrics={metrics} stepCount={stepCount} />
        </div>
      </div>
    </div>
  );
}
