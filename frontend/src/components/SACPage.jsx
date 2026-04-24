import React from 'react';
import {
  ComparisonChart,
  AgentPanel,
  AlgoStatsPanel,
  COLORS,
} from './Dashboard';
import InfoTooltip from './InfoTooltip';
import { ExplainButton } from './ExplainModal';

/**
 * SAC Model tab — reuses the dashboard's existing chart components with a
 * SAC-only view filter, and adds an educational explanation panel above.
 * The chart logic and styling are untouched.
 */
export default function SACPage({
  sacMetrics,
  cubicMetrics,
  sacCurrent,
  sacStepCount,
  learningMode = true,
}) {
  const chartData = sacMetrics.map((m) => ({
    time: m.time,
    sacRtt: m.rtt,
    sacThroughput: m.throughput,
    sacCwnd: m.cwnd,
    sacReward: m.reward,
  }));

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-indigo-300">SAC Model</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Soft Actor-Critic — a reinforcement-learning agent that adaptively
            tunes the congestion window.
          </p>
        </div>
        <span className="text-[10px] text-gray-600 font-mono">
          Live SAC samples: {sacStepCount}
        </span>
      </div>

      {/* Explanation panel (only in Learning Mode) */}
      {learningMode && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ExplainCard
            title="Reinforcement Learning"
            accent="text-indigo-400"
            body="SAC learns by interacting with the network: it observes a state (RTT, throughput, loss, cwnd), takes an action that scales cwnd, and receives a reward reflecting goodput vs. latency/loss. Over many steps it learns a policy that maps network conditions to good actions."
          />
          <ExplainCard
            title="Adaptive Congestion Control"
            accent="text-violet-400"
            body="Unlike CUBIC's fixed growth curve, SAC's behaviour is learned: it can be aggressive when the link is underused and conservative when RTT rises or loss appears. The policy generalises across conditions without hand-tuned constants."
          />
          <ExplainCard
            title="Goal of SAC"
            accent="text-emerald-400"
            body="Maximise expected reward = high throughput + low RTT + low loss, while maintaining stability. SAC additionally maximises policy entropy, which keeps exploration healthy and avoids collapsing to brittle strategies."
          />
        </div>
      )}

      {/* Agent decision strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2" id="tour-sac-agent">
          <AgentPanel current={sacCurrent} />
        </div>
        <AlgoStatsPanel
          label="SAC (RL)"
          color={COLORS.sac.primary}
          current={sacCurrent}
          metrics={sacMetrics}
          stepCount={sacStepCount}
        />
      </div>

      {/* Charts (reused from dashboard) */}
      <div className="space-y-4">
        <SectionHeader
          title="SAC Live Telemetry"
          tooltip="These are the exact same charts used in the comparison dashboard, filtered to the SAC flow only."
        />

        <ChartWithExplain id="tour-sac-rtt" metric="rtt" learningMode={learningMode}>
          <ComparisonChart
            data={chartData}
            sacKey="sacRtt"
            cubicKey="cubicRtt"
            label="Round Trip Time (RTT)"
            unit=" ms"
            domain={[0, 300]}
            refLine={{ value: 80, color: '#10b981', label: 'min RTT' }}
            view="SAC"
          />
        </ChartWithExplain>

        <ChartWithExplain id="tour-sac-throughput" metric="throughput" learningMode={learningMode}>
          <ComparisonChart
            data={chartData}
            sacKey="sacThroughput"
            cubicKey="cubicThroughput"
            label="Throughput"
            unit=" Mbps"
            domain={[0, 2.5]}
            refLine={{ value: 2.0, color: '#f59e0b', label: '2 Mbps' }}
            view="SAC"
          />
        </ChartWithExplain>

        <ChartWithExplain id="tour-sac-cwnd" metric="cwnd" learningMode={learningMode}>
          <ComparisonChart
            data={chartData}
            sacKey="sacCwnd"
            cubicKey="cubicCwnd"
            label="Congestion Window (cWnd)"
            unit=" KB"
            view="SAC"
          />
        </ChartWithExplain>

        <ChartWithExplain id="tour-sac-reward" metric="reward" learningMode={learningMode}>
          <ComparisonChart
            data={chartData}
            sacKey="sacReward"
            cubicKey="cubicReward"
            label="Reward (per step)"
            unit=""
            domain={[-2, 1.1]}
            refLine={{ value: 0, color: '#4b5563', label: '' }}
            view="SAC"
          />
        </ChartWithExplain>
      </div>

      <p className="text-[11px] text-gray-600">
        CUBIC samples collected in parallel: {cubicMetrics.length}. Switch to
        the <span className="text-orange-300">TCP CUBIC</span> or
        <span className="text-amber-300"> Comparison</span> tabs to contrast
        behaviours.
      </p>
    </div>
  );
}

function ExplainCard({ title, accent, body }) {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
      <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${accent}`}>
        {title}
      </h3>
      <p className="text-[12px] text-gray-300 leading-relaxed">{body}</p>
    </div>
  );
}

function SectionHeader({ title, tooltip }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      {tooltip && <InfoTooltip text={tooltip} />}
    </div>
  );
}

/**
 * Wraps a chart with a tour-anchor id and an "Explain this graph" button.
 * The Explain button appears in Learning Mode.
 */
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
