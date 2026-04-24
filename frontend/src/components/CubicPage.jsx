import React from 'react';
import {
  ComparisonChart,
  AlgoStatsPanel,
  COLORS,
} from './Dashboard';
import NetworkTopology from './NetworkTopology';
import CwndPhaseChart from './CwndPhaseChart';
import InfoTooltip from './InfoTooltip';
import { ExplainButton } from './ExplainModal';

/**
 * TCP CUBIC tab — educational content + CUBIC-only charts +
 * network topology + CWND phase visualization.
 */
export default function CubicPage({
  cubicMetrics,
  cubicCurrent,
  cubicStepCount,
  learningMode = true,
}) {
  const chartData = cubicMetrics.map((m) => ({
    time: m.time,
    cubicRtt: m.rtt,
    cubicThroughput: m.throughput,
    cubicCwnd: m.cwnd,
    cubicReward: m.reward,
  }));

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-orange-300">TCP CUBIC</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            The loss-based congestion-control algorithm used by default in
            Linux since 2006.
          </p>
        </div>
        <span className="text-[10px] text-gray-600 font-mono">
          Live CUBIC samples: {cubicStepCount}
        </span>
      </div>

      {/* Explanation panel: three phases */}
      {learningMode && (
        <div id="tour-cubic-phases" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PhaseCard
            accent="text-emerald-400"
            title="1. Slow Start"
            body="At the start of a connection, CUBIC grows cWnd exponentially — roughly doubling each RTT — until it hits the slow-start threshold (ssthresh) or detects the first loss. The goal is to discover available bandwidth quickly."
            formula="cwnd ← cwnd + MSS per ACK"
          />
          <PhaseCard
            accent="text-blue-400"
            title="2. Congestion Avoidance"
            body="After slow start, CUBIC uses a cubic function of time since the last loss to probe the network. It grows slowly near the previous maximum (Wmax) and faster beyond it — independent of RTT, which keeps it fair to flows with different RTTs."
            formula="W(t) = C·(t − K)^3 + Wmax"
          />
          <PhaseCard
            accent="text-red-400"
            title="3. Loss Recovery"
            body="On packet loss, cWnd is multiplicatively decreased (β≈0.7) and ssthresh is updated. CUBIC then re-enters the cubic growth phase, re-probing toward Wmax — this is the classic 'sawtooth' pattern."
            formula="Wmax ← cwnd;   cwnd ← β · cwnd"
          />
        </div>
      )}

      {/* Network topology */}
      <div id="tour-cubic-topology" className="relative">
        {learningMode && (
          <div className="absolute top-2 right-2 z-10">
            <ExplainButton metric="topology" />
          </div>
        )}
        <NetworkTopology />
      </div>

      {/* CWND phase visualization */}
      <div id="tour-cubic-cwnd" className="relative">
        {learningMode && (
          <div className="absolute top-2 right-2 z-10">
            <ExplainButton metric="phases" />
          </div>
        )}
        <CwndPhaseChart metrics={cubicMetrics} accentColor={COLORS.cubic.primary} />
      </div>

      {/* Current stats */}
      <AlgoStatsPanel
        label="CUBIC"
        color={COLORS.cubic.primary}
        current={cubicCurrent}
        metrics={cubicMetrics}
        stepCount={cubicStepCount}
      />

      {/* Reused live charts (CUBIC only) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-200">
            CUBIC Live Telemetry
          </h3>
          <InfoTooltip text="Same chart components as the comparison dashboard, filtered to the CUBIC flow." />
        </div>

        <ChartWithExplain id="tour-cubic-rtt" metric="rtt" learningMode={learningMode}>
          <ComparisonChart
            data={chartData}
            sacKey="sacRtt"
            cubicKey="cubicRtt"
            label="Round Trip Time (RTT)"
            unit=" ms"
            domain={[0, 300]}
            refLine={{ value: 80, color: '#10b981', label: 'min RTT' }}
            view="CUBIC"
          />
        </ChartWithExplain>

        <ChartWithExplain id="tour-cubic-throughput" metric="throughput" learningMode={learningMode}>
          <ComparisonChart
            data={chartData}
            sacKey="sacThroughput"
            cubicKey="cubicThroughput"
            label="Throughput"
            unit=" Mbps"
            domain={[0, 2.5]}
            refLine={{ value: 2.0, color: '#f59e0b', label: '2 Mbps' }}
            view="CUBIC"
          />
        </ChartWithExplain>

        <ChartWithExplain metric="cwnd" learningMode={learningMode}>
          <ComparisonChart
            data={chartData}
            sacKey="sacCwnd"
            cubicKey="cubicCwnd"
            label="Congestion Window (cWnd)"
            unit=" KB"
            view="CUBIC"
          />
        </ChartWithExplain>
      </div>
    </div>
  );
}

function PhaseCard({ accent, title, body, formula }) {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
      <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${accent}`}>
        {title}
      </h3>
      <p className="text-[12px] text-gray-300 leading-relaxed">{body}</p>
      <div className="mt-3 bg-gray-950/60 rounded-lg px-2 py-1.5 text-[11px] font-mono text-gray-400 border border-gray-800">
        {formula}
      </div>
    </div>
  );
}

function ChartWithExplain({ id, metric, learningMode, children }) {
  return (
    <div id={id} className="relative">
      {learningMode && (
        <div className="absolute top-2 right-2 z-10">
          <ExplainButton metric={metric} />
        </div>
      )}
      {children}
    </div>
  );
}
