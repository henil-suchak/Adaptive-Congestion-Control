import React, { useMemo } from 'react';

const LINK_CAPACITY = 2.0;

function computeSummary(sacMetrics, cubicMetrics) {
  if (sacMetrics.length < 5 || cubicMetrics.length < 5) return null;

  const avg = (arr, key) => arr.reduce((s, m) => s + (m[key] || 0), 0) / arr.length;

  const sacAvgTput  = avg(sacMetrics, 'throughput');
  const cubicAvgTput = avg(cubicMetrics, 'throughput');
  const sacAvgRtt   = avg(sacMetrics, 'rtt');
  const cubicAvgRtt  = avg(cubicMetrics, 'rtt');
  const sacAvgLoss  = avg(sacMetrics, 'loss');
  const cubicAvgLoss = avg(cubicMetrics, 'loss');

  const eps = 1e-9;
  const maxTput = Math.max(sacAvgTput, cubicAvgTput);
  const minRtt  = Math.min(sacAvgRtt, cubicAvgRtt);

  const score = (avgTput, avgRtt, avgLoss) => (
    0.45 * (maxTput > eps ? avgTput / maxTput : 0.5) +
    0.35 * (avgRtt > eps ? Math.min(minRtt / avgRtt, 1) : 0.5) +
    0.20 * (1 - Math.min(avgLoss, 1))
  );

  const sacScore   = score(sacAvgTput, sacAvgRtt, sacAvgLoss);
  const cubicScore = score(cubicAvgTput, cubicAvgRtt, cubicAvgLoss);
  const winner = sacScore >= cubicScore ? 'SAC' : 'CUBIC';

  const tputDiff = cubicAvgTput > eps ? ((sacAvgTput - cubicAvgTput) / cubicAvgTput * 100) : 0;
  const rttDiff  = cubicAvgRtt > eps  ? ((cubicAvgRtt - sacAvgRtt) / cubicAvgRtt * 100) : 0;
  const lossDiff = cubicAvgLoss > eps ? ((cubicAvgLoss - sacAvgLoss) / cubicAvgLoss * 100) : 0;

  let conclusion;
  const gap = Math.abs(sacScore - cubicScore);
  if (winner === 'SAC') {
    conclusion = gap > 0.1
      ? 'SAC (RL-based) significantly outperforms CUBIC in this simulation, demonstrating the effectiveness of adaptive congestion control.'
      : 'SAC performs slightly better than CUBIC. The RL agent shows marginal improvements in network adaptation.';
  } else {
    conclusion = gap > 0.1
      ? 'CUBIC outperforms SAC in this scenario. The traditional algorithm handles this network condition more effectively.'
      : 'CUBIC performs slightly better, but both algorithms show comparable results in this simulation.';
  }

  return {
    winner, sacScore, cubicScore,
    sacAvgTput, cubicAvgTput, tputDiff,
    sacAvgRtt, cubicAvgRtt, rttDiff,
    sacAvgLoss, cubicAvgLoss, lossDiff,
    sacUtil: (sacAvgTput / LINK_CAPACITY * 100),
    cubicUtil: (cubicAvgTput / LINK_CAPACITY * 100),
    conclusion,
  };
}

function MetricRow({ label, sacLabel, cubicLabel, diff, unit, positiveGood }) {
  const better = positiveGood ? diff > 0 : diff < 0;
  const color = Math.abs(diff) < 1 ? 'text-gray-400' : (better ? 'text-emerald-400' : 'text-red-400');
  const arrow = Math.abs(diff) < 1 ? '≈' : (better ? '↑' : '↓');

  return (
    <div className="bg-gray-950/60 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
        <span className={`font-mono text-xs font-semibold ${color}`}>
          {arrow} {Math.abs(diff).toFixed(1)}%
        </span>
      </div>
      <div className="flex justify-between text-xs font-mono">
        <span className="text-indigo-300">{sacLabel}{unit && ` ${unit}`}</span>
        <span className="text-orange-300">{cubicLabel}{unit && ` ${unit}`}</span>
      </div>
    </div>
  );
}

export default function SummaryModal({ open, onClose, sacMetrics, cubicMetrics }) {
  const summary = useMemo(
    () => computeSummary(sacMetrics, cubicMetrics),
    [sacMetrics, cubicMetrics],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
      <div
        className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl mx-4 animate-[scaleIn_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">📊 Simulation Summary</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none cursor-pointer">✕</button>
        </div>

        {!summary ? (
          <p className="text-gray-500 text-sm text-center py-8">
            Not enough data yet — need at least 5 samples from each algorithm.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Winner */}
            <div className={`rounded-xl p-4 border text-center ${
              summary.winner === 'SAC'
                ? 'bg-indigo-500/10 border-indigo-500/30'
                : 'bg-orange-500/10 border-orange-500/30'
            }`}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Winner</p>
              <p className={`text-2xl font-bold ${
                summary.winner === 'SAC' ? 'text-indigo-400' : 'text-orange-400'
              }`}>{summary.winner}</p>
              <div className="flex justify-center gap-6 mt-2 text-xs font-mono">
                <span className="text-indigo-300">SAC {(summary.sacScore * 100).toFixed(1)}%</span>
                <span className="text-orange-300">CUBIC {(summary.cubicScore * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Metric rows */}
            <div className="grid grid-cols-2 gap-3">
              <MetricRow
                label="Throughput"
                sacLabel={summary.sacAvgTput.toFixed(4)}
                cubicLabel={summary.cubicAvgTput.toFixed(4)}
                diff={summary.tputDiff}
                unit="Mbps"
                positiveGood
              />
              <MetricRow
                label="RTT"
                sacLabel={summary.sacAvgRtt.toFixed(2)}
                cubicLabel={summary.cubicAvgRtt.toFixed(2)}
                diff={summary.rttDiff}
                unit="ms"
                positiveGood
              />
              <MetricRow
                label="Packet Loss"
                sacLabel={`${(summary.sacAvgLoss * 100).toFixed(2)}%`}
                cubicLabel={`${(summary.cubicAvgLoss * 100).toFixed(2)}%`}
                diff={summary.lossDiff}
                unit=""
                positiveGood
              />
              <div className="bg-gray-950/60 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Utilization</p>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-indigo-300">{summary.sacUtil.toFixed(1)}%</span>
                  <span className="text-orange-300">{summary.cubicUtil.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Conclusion */}
            <div className="bg-gray-950/60 rounded-xl p-4 border border-gray-800">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Conclusion</p>
              <p className="text-gray-300 text-sm leading-relaxed">{summary.conclusion}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
