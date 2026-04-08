import React, { useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { useMetricsWebSocket } from '../hooks/useMetricsWebSocket';

const COLORS = {
  sac:   { primary: '#818cf8', light: '#a5b4fc', bg: 'rgba(129,140,248,0.15)' },
  cubic: { primary: '#fb923c', light: '#fdba74', bg: 'rgba(251,146,60,0.15)' },
};

/* ── View Toggle ──────────────────────────────────────────────────────── */

function ViewToggle({ view, setView }) {
  const opts = [
    { id: 'BOTH',  label: 'Both' },
    { id: 'SAC',   label: 'SAC' },
    { id: 'CUBIC', label: 'CUBIC' },
  ];
  return (
    <div className="flex bg-gray-900 rounded-lg border border-gray-800 p-0.5">
      {opts.map(o => (
        <button
          key={o.id}
          onClick={() => setView(o.id)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            view === o.id
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Comparison Chart (dual-line, synced) ─────────────────────────────── */

function ComparisonChart({ data, sacKey, cubicKey, label, unit, domain, refLine, view }) {
  const sacGradient  = `grad-sac-${sacKey}`;
  const cubicGradient = `grad-cubic-${cubicKey}`;
  const showSac   = view === 'BOTH' || view === 'SAC';
  const showCubic = view === 'BOTH' || view === 'CUBIC';

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider">
          {label}
        </h3>
        <div className="flex items-center gap-3 text-[10px]">
          {showSac && (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: COLORS.sac.primary }} />
              <span className="text-gray-500">SAC</span>
            </span>
          )}
          {showCubic && (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: COLORS.cubic.primary }} />
              <span className="text-gray-500">CUBIC</span>
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={data} syncId="comparison">
          <defs>
            <linearGradient id={sacGradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.sac.primary} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLORS.sac.primary} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={cubicGradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.cubic.primary} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLORS.cubic.primary} stopOpacity={0} />
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
            width={50}
            unit={unit}
            tickLine={false}
            axisLine={{ stroke: '#1f2937' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '8px',
              fontSize: '11px',
              padding: '8px 12px',
            }}
            labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
            formatter={(value, name) => {
              const label = name.startsWith('sac') ? 'SAC' : 'CUBIC';
              return [`${Number(value).toFixed(4)}${unit}`, label];
            }}
          />
          {refLine && (
            <ReferenceLine
              y={refLine.value}
              stroke={refLine.color}
              strokeDasharray="5 5"
              label={{ value: refLine.label, fill: refLine.color, fontSize: 9, position: 'right' }}
            />
          )}
          {showSac && (
            <Area
              type="monotone"
              dataKey={sacKey}
              stroke={COLORS.sac.primary}
              fill={`url(#${sacGradient})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
          {showCubic && (
            <Area
              type="monotone"
              dataKey={cubicKey}
              stroke={COLORS.cubic.primary}
              fill={`url(#${cubicGradient})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Stats Panel (per-algorithm) ──────────────────────────────────────── */

function AlgoStatsPanel({ label, color, current, metrics, stepCount }) {
  if (!current) {
    return (
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color }}>
          {label}
        </h3>
        <div className="flex items-center justify-center h-24">
          <div className="text-center">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2"
                 style={{ borderColor: color, borderTopColor: 'transparent' }} />
            <p className="text-gray-600 text-xs">Waiting...</p>
          </div>
        </div>
      </div>
    );
  }

  const avgRtt = metrics.length > 0
    ? (metrics.reduce((s, m) => s + (m.rtt || 0), 0) / metrics.length).toFixed(2) : '0.00';
  const avgTput = metrics.length > 0
    ? (metrics.reduce((s, m) => s + (m.throughput || 0), 0) / metrics.length).toFixed(4) : '0.0000';

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</h3>
        <span className="text-[10px] text-gray-600 font-mono">{stepCount} steps</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="RTT" value={`${(current.rttMs || 0).toFixed(2)}`} unit="ms" color="text-blue-400" />
        <MiniStat label="Tput" value={`${(current.throughputMbps || 0).toFixed(4)}`} unit="Mbps" color="text-emerald-400" />
        <MiniStat label="cWnd" value={`${Math.round(current.cwndBytes || 0).toLocaleString()}`} unit="B" color="text-violet-400" />
        <MiniStat label="Loss" value={`${((current.packetLossRate || 0) * 100).toFixed(2)}`} unit="%" color="text-amber-400" />
      </div>
      <div className="mt-3 pt-2 border-t border-gray-800 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-gray-500">Avg RTT</span>
          <span className="text-gray-300 font-mono">{avgRtt} ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Avg Tput</span>
          <span className="text-gray-300 font-mono">{avgTput} Mbps</span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, unit, color }) {
  return (
    <div className="bg-gray-950/60 rounded-lg p-2">
      <p className="text-gray-500 text-[9px] uppercase tracking-wider">{label}</p>
      <p className={`font-mono text-xs font-semibold ${color}`}>
        {value} <span className="text-gray-600 text-[9px]">{unit}</span>
      </p>
    </div>
  );
}

/* ── SAC Agent Decision Panel ─────────────────────────────────────────── */

function AgentPanel({ current }) {
  if (!current) return null;

  const action = current.action || 1.0;
  let actionLabel, actionColor;
  if (action >= 1.15)      { actionLabel = '▲▲ GROW FAST'; actionColor = 'text-emerald-400'; }
  else if (action >= 1.05) { actionLabel = '▲  GROW';      actionColor = 'text-emerald-300'; }
  else if (action >= 0.95) { actionLabel = '── HOLD';      actionColor = 'text-yellow-400'; }
  else if (action >= 0.85) { actionLabel = '▼  SHRINK';    actionColor = 'text-red-300'; }
  else                     { actionLabel = '▼▼ SHRINK';    actionColor = 'text-red-400'; }

  const reward = current.reward || 0;
  let rewardColor;
  if (reward >= 0.7)       rewardColor = 'text-emerald-400';
  else if (reward >= 0.4)  rewardColor = 'text-blue-400';
  else if (reward >= 0.1)  rewardColor = 'text-yellow-400';
  else if (reward >= 0)    rewardColor = 'text-gray-400';
  else                     rewardColor = 'text-red-400';

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
        SAC Agent
      </h3>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-[9px] uppercase">Action</p>
          <p className={`font-mono font-bold text-sm ${actionColor}`}>{actionLabel}</p>
          <p className="text-gray-600 text-[10px] font-mono mt-0.5">×{action.toFixed(4)}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-[9px] uppercase">Reward</p>
          <p className={`font-mono font-bold text-sm ${rewardColor}`}>
            {reward >= 0 ? '+' : ''}{reward.toFixed(4)}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Comparison Panel ─────────────────────────────────────────────────── */

function ComparisonPanel({ sacMetrics, cubicMetrics }) {
  const sacSamples  = sacMetrics.length;
  const cubicSamples = cubicMetrics.length;
  const hasBoth = sacSamples >= 5 && cubicSamples >= 5;

  // Live client-side comparison from WebSocket data
  const liveComparison = React.useMemo(() => {
    if (!hasBoth) return null;

    const avg = (arr, key) => arr.reduce((s, m) => s + (m[key] || 0), 0) / arr.length;

    const sacAvgRtt  = avg(sacMetrics, 'rtt');
    const sacAvgTput = avg(sacMetrics, 'throughput');
    const sacAvgLoss = avg(sacMetrics, 'loss');
    const cubicAvgRtt  = avg(cubicMetrics, 'rtt');
    const cubicAvgTput = avg(cubicMetrics, 'throughput');
    const cubicAvgLoss = avg(cubicMetrics, 'loss');

    const eps = 1e-9;
    const rttPct  = cubicAvgRtt > eps ? ((cubicAvgRtt - sacAvgRtt) / cubicAvgRtt * 100) : 0;
    const tputPct = cubicAvgTput > eps ? ((sacAvgTput - cubicAvgTput) / cubicAvgTput * 100) : 0;
    const lossPct = cubicAvgLoss > eps ? ((cubicAvgLoss - sacAvgLoss) / cubicAvgLoss * 100) : 0;

    // Weighted score
    const maxTput = Math.max(sacAvgTput, cubicAvgTput);
    const minRtt  = Math.min(sacAvgRtt, cubicAvgRtt);

    const sacScore = (
      0.45 * (maxTput > eps ? sacAvgTput / maxTput : 0.5) +
      0.35 * (sacAvgRtt > eps ? Math.min(minRtt / sacAvgRtt, 1) : 0.5) +
      0.20 * (1 - Math.min(sacAvgLoss, 1))
    );
    const cubicScore = (
      0.45 * (maxTput > eps ? cubicAvgTput / maxTput : 0.5) +
      0.35 * (cubicAvgRtt > eps ? Math.min(minRtt / cubicAvgRtt, 1) : 0.5) +
      0.20 * (1 - Math.min(cubicAvgLoss, 1))
    );

    return {
      sacAvgRtt, sacAvgTput, sacAvgLoss,
      cubicAvgRtt, cubicAvgTput, cubicAvgLoss,
      rttPct, tputPct, lossPct,
      sacScore, cubicScore,
      winner: sacScore >= cubicScore ? 'SAC' : 'CUBIC',
    };
  }, [sacMetrics, cubicMetrics, hasBoth]);

  if (!hasBoth) {
    return (
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-3">
          Comparison
        </h3>
        <p className="text-gray-500 text-xs text-center py-4">
          Need data from both flows to compare...
        </p>
        <div className="flex justify-center gap-2 text-[10px]">
          <span className="text-gray-600">SAC: {sacSamples}</span>
          <span className="text-gray-700">|</span>
          <span className="text-gray-600">CUBIC: {cubicSamples}</span>
        </div>
      </div>
    );
  }

  const c = liveComparison;
  const winnerColor = c.winner === 'SAC' ? 'text-indigo-400' : 'text-orange-400';
  const winnerBg = c.winner === 'SAC' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-orange-500/10 border-orange-500/30';

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
        Live Comparison
      </h3>

      {/* Winner badge */}
      <div className={`rounded-lg p-3 border ${winnerBg} text-center`}>
        <p className="text-[10px] text-gray-500 uppercase">Winner</p>
        <p className={`font-bold text-lg ${winnerColor}`}>{c.winner}</p>
        <div className="flex justify-center gap-4 mt-1 text-[10px] font-mono">
          <span className="text-indigo-300">SAC {(c.sacScore * 100).toFixed(1)}%</span>
          <span className="text-orange-300">CUBIC {(c.cubicScore * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Improvement metrics */}
      <div className="space-y-2">
        <ImprovementRow
          label="RTT"
          pct={c.rttPct}
          sacVal={`${c.sacAvgRtt.toFixed(2)} ms`}
          cubicVal={`${c.cubicAvgRtt.toFixed(2)} ms`}
          positiveIsBetter={true}
        />
        <ImprovementRow
          label="Throughput"
          pct={c.tputPct}
          sacVal={`${c.sacAvgTput.toFixed(4)} Mbps`}
          cubicVal={`${c.cubicAvgTput.toFixed(4)} Mbps`}
          positiveIsBetter={true}
        />
        <ImprovementRow
          label="Pkt Loss"
          pct={c.lossPct}
          sacVal={`${(c.sacAvgLoss * 100).toFixed(2)}%`}
          cubicVal={`${(c.cubicAvgLoss * 100).toFixed(2)}%`}
          positiveIsBetter={true}
        />
      </div>

      {/* Score bar */}
      <div className="pt-2 border-t border-gray-800">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>SAC</span>
          <span>CUBIC</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
          <div
            className="bg-indigo-500 transition-all duration-500"
            style={{ width: `${(c.sacScore / (c.sacScore + c.cubicScore)) * 100}%` }}
          />
          <div
            className="bg-orange-500 transition-all duration-500"
            style={{ width: `${(c.cubicScore / (c.sacScore + c.cubicScore)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function avg(arr, key) {
  if (!arr.length) return 0;
  return arr.reduce((s, m) => s + (m[key] || 0), 0) / arr.length;
}

function ImprovementRow({ label, pct, sacVal, cubicVal, positiveIsBetter }) {
  const isPositive = pct > 0;
  const isBetter = positiveIsBetter ? isPositive : !isPositive;
  const color = Math.abs(pct) < 1 ? 'text-gray-400' : (isBetter ? 'text-emerald-400' : 'text-red-400');
  const arrow = Math.abs(pct) < 1 ? '≈' : (isBetter ? '↑' : '↓');

  return (
    <div className="bg-gray-950/40 rounded-lg p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-500 text-[10px] uppercase">{label}</span>
        <span className={`font-mono text-xs font-semibold ${color}`}>
          {arrow} {Math.abs(pct).toFixed(1)}%
        </span>
      </div>
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-indigo-300">{sacVal}</span>
        <span className="text-orange-300">{cubicVal}</span>
      </div>
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────────────────────────────── */

export default function Dashboard() {
  const {
    sacMetrics, cubicMetrics, mergedMetrics,
    sacCurrent, cubicCurrent,
    connected, sacStepCount, cubicStepCount,
  } = useMetricsWebSocket();

  const [view, setView] = useState('BOTH');

  // Choose data source based on view
  const chartData = view === 'BOTH'
    ? mergedMetrics
    : view === 'SAC'
      ? sacMetrics.map(m => ({ time: m.time, sacRtt: m.rtt, sacThroughput: m.throughput, sacCwnd: m.cwnd, sacReward: m.reward }))
      : cubicMetrics.map(m => ({ time: m.time, cubicRtt: m.rtt, cubicThroughput: m.throughput, cubicCwnd: m.cwnd, cubicReward: m.reward }));

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-violet-400 to-orange-400 bg-clip-text text-transparent">
            SAC vs CUBIC — TCP Congestion Control
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Live Dual-Flow Comparison Dashboard — ns-3 Simulation
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ViewToggle view={view} setView={setView} />
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          <div className="bg-gray-900 rounded-lg px-3 py-1.5 border border-gray-800 flex gap-3">
            <span className="text-[10px]">
              <span className="text-indigo-400">SAC</span>{' '}
              <span className="text-white font-mono">{sacStepCount}</span>
            </span>
            <span className="text-gray-700">|</span>
            <span className="text-[10px]">
              <span className="text-orange-400">CUBIC</span>{' '}
              <span className="text-white font-mono">{cubicStepCount}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main grid: 3 cols charts + 1 col panels */}
      <div className="grid grid-cols-4 gap-4">
        {/* Charts column */}
        <div className="col-span-3 space-y-4">
          <ComparisonChart
            data={chartData}
            sacKey="sacRtt" cubicKey="cubicRtt"
            label="Round Trip Time (RTT)"
            unit=" ms"
            domain={[0, 300]}
            refLine={{ value: 80, color: '#10b981', label: 'min RTT' }}
            view={view}
          />
          <ComparisonChart
            data={chartData}
            sacKey="sacThroughput" cubicKey="cubicThroughput"
            label="Throughput"
            unit=" Mbps"
            domain={[0, 2.5]}
            refLine={{ value: 2.0, color: '#f59e0b', label: '2 Mbps' }}
            view={view}
          />
          <ComparisonChart
            data={chartData}
            sacKey="sacCwnd" cubicKey="cubicCwnd"
            label="Congestion Window (cWnd)"
            unit=" KB"
            view={view}
          />
          <ComparisonChart
            data={chartData}
            sacKey="sacReward" cubicKey="cubicReward"
            label="Reward (SAC only for CUBIC=0)"
            unit=""
            domain={[-2, 1.1]}
            refLine={{ value: 0, color: '#4b5563', label: '' }}
            view={view}
          />
        </div>

        {/* Right panel */}
        <div className="col-span-1 space-y-4">
          <ComparisonPanel sacMetrics={sacMetrics} cubicMetrics={cubicMetrics} />
          <AgentPanel current={sacCurrent} />
          <AlgoStatsPanel
            label="SAC (RL)"
            color={COLORS.sac.primary}
            current={sacCurrent}
            metrics={sacMetrics}
            stepCount={sacStepCount}
          />
          <AlgoStatsPanel
            label="CUBIC"
            color={COLORS.cubic.primary}
            current={cubicCurrent}
            metrics={cubicMetrics}
            stepCount={cubicStepCount}
          />
        </div>
      </div>
    </div>
  );
}
