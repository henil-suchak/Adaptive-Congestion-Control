import React, { useMemo } from 'react';

const WEIGHTS = { throughput: 0.45, rtt: 0.35, loss: 0.20 };

function computeScores(sacMetrics, cubicMetrics) {
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

  const sacTputNorm  = maxTput > eps ? sacAvgTput / maxTput : 0.5;
  const cubicTputNorm = maxTput > eps ? cubicAvgTput / maxTput : 0.5;
  const sacRttNorm   = sacAvgRtt > eps ? Math.min(minRtt / sacAvgRtt, 1) : 0.5;
  const cubicRttNorm  = cubicAvgRtt > eps ? Math.min(minRtt / cubicAvgRtt, 1) : 0.5;
  const sacLossNorm  = 1 - Math.min(sacAvgLoss, 1);
  const cubicLossNorm = 1 - Math.min(cubicAvgLoss, 1);

  const sacScore   = WEIGHTS.throughput * sacTputNorm + WEIGHTS.rtt * sacRttNorm + WEIGHTS.loss * sacLossNorm;
  const cubicScore = WEIGHTS.throughput * cubicTputNorm + WEIGHTS.rtt * cubicRttNorm + WEIGHTS.loss * cubicLossNorm;

  return {
    sac: {
      throughput: { raw: sacAvgTput, norm: sacTputNorm, weighted: WEIGHTS.throughput * sacTputNorm },
      rtt:        { raw: sacAvgRtt,  norm: sacRttNorm,  weighted: WEIGHTS.rtt * sacRttNorm },
      loss:       { raw: sacAvgLoss, norm: sacLossNorm, weighted: WEIGHTS.loss * sacLossNorm },
      total: sacScore,
    },
    cubic: {
      throughput: { raw: cubicAvgTput, norm: cubicTputNorm, weighted: WEIGHTS.throughput * cubicTputNorm },
      rtt:        { raw: cubicAvgRtt,  norm: cubicRttNorm,  weighted: WEIGHTS.rtt * cubicRttNorm },
      loss:       { raw: cubicAvgLoss, norm: cubicLossNorm, weighted: WEIGHTS.loss * cubicLossNorm },
      total: cubicScore,
    },
    winner: sacScore >= cubicScore ? 'SAC' : 'CUBIC',
  };
}

function ScoreBar({ label, sacVal, cubicVal, weight }) {
  const max = Math.max(sacVal, cubicVal, 0.01);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] text-gray-600 font-mono">weight: {(weight * 100).toFixed(0)}%</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-indigo-400 w-10">SAC</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${(sacVal / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-300 font-mono w-14 text-right">{sacVal.toFixed(4)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-orange-400 w-10">CUBIC</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${(cubicVal / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-300 font-mono w-14 text-right">{cubicVal.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ScoreModal({ open, onClose, sacMetrics, cubicMetrics }) {
  const scores = useMemo(
    () => computeScores(sacMetrics, cubicMetrics),
    [sacMetrics, cubicMetrics],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
      <div
        className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-xl shadow-2xl mx-4 animate-[scaleIn_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">📊 Score Breakdown</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none cursor-pointer">✕</button>
        </div>

        {!scores ? (
          <p className="text-gray-500 text-sm text-center py-8">
            Not enough data yet — need at least 5 samples from each algorithm.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Weighted contributions */}
            <div className="space-y-4">
              <ScoreBar
                label="Throughput"
                sacVal={scores.sac.throughput.weighted}
                cubicVal={scores.cubic.throughput.weighted}
                weight={WEIGHTS.throughput}
              />
              <ScoreBar
                label="RTT (Latency)"
                sacVal={scores.sac.rtt.weighted}
                cubicVal={scores.cubic.rtt.weighted}
                weight={WEIGHTS.rtt}
              />
              <ScoreBar
                label="Packet Loss"
                sacVal={scores.sac.loss.weighted}
                cubicVal={scores.cubic.loss.weighted}
                weight={WEIGHTS.loss}
              />
            </div>

            {/* Total scores */}
            <div className="bg-gray-950/60 rounded-xl p-4 border border-gray-800">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Total Score</p>
              <div className="flex items-end justify-between">
                <div className="text-center">
                  <p className="text-2xl font-bold text-indigo-400 font-mono">
                    {(scores.sac.total * 100).toFixed(1)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">SAC</p>
                </div>
                <div className={`text-center px-4 py-2 rounded-lg border ${
                  scores.winner === 'SAC'
                    ? 'bg-indigo-500/10 border-indigo-500/30'
                    : 'bg-orange-500/10 border-orange-500/30'
                }`}>
                  <p className="text-[10px] text-gray-500 uppercase">Winner</p>
                  <p className={`text-lg font-bold ${
                    scores.winner === 'SAC' ? 'text-indigo-400' : 'text-orange-400'
                  }`}>{scores.winner}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-400 font-mono">
                    {(scores.cubic.total * 100).toFixed(1)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">CUBIC</p>
                </div>
              </div>
            </div>

            {/* Raw values table */}
            <div className="bg-gray-950/60 rounded-xl p-4 border border-gray-800">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Raw Values</p>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-500 text-left">
                    <th className="pb-2 font-medium">Metric</th>
                    <th className="pb-2 font-medium text-indigo-400">SAC</th>
                    <th className="pb-2 font-medium text-orange-400">CUBIC</th>
                    <th className="pb-2 font-medium">Normalized</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300 font-mono">
                  <tr>
                    <td className="py-1 text-gray-500">Throughput</td>
                    <td className="py-1">{scores.sac.throughput.raw.toFixed(4)} Mbps</td>
                    <td className="py-1">{scores.cubic.throughput.raw.toFixed(4)} Mbps</td>
                    <td className="py-1">{scores.sac.throughput.norm.toFixed(3)} / {scores.cubic.throughput.norm.toFixed(3)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-500">RTT</td>
                    <td className="py-1">{scores.sac.rtt.raw.toFixed(2)} ms</td>
                    <td className="py-1">{scores.cubic.rtt.raw.toFixed(2)} ms</td>
                    <td className="py-1">{scores.sac.rtt.norm.toFixed(3)} / {scores.cubic.rtt.norm.toFixed(3)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-500">Pkt Loss</td>
                    <td className="py-1">{(scores.sac.loss.raw * 100).toFixed(2)}%</td>
                    <td className="py-1">{(scores.cubic.loss.raw * 100).toFixed(2)}%</td>
                    <td className="py-1">{scores.sac.loss.norm.toFixed(3)} / {scores.cubic.loss.norm.toFixed(3)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Weights note */}
            <p className="text-[10px] text-gray-600 text-center">
              Score = {(WEIGHTS.throughput * 100).toFixed(0)}% Throughput + {(WEIGHTS.rtt * 100).toFixed(0)}% RTT + {(WEIGHTS.loss * 100).toFixed(0)}% Loss · Normalized to [0, 1]
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
