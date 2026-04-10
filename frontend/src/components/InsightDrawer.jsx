import React, { useMemo } from 'react';

function analyzeInsights(sacMetrics, cubicMetrics) {
  if (sacMetrics.length < 5 || cubicMetrics.length < 5) return null;

  const avg  = (arr, key) => arr.reduce((s, m) => s + (m[key] || 0), 0) / arr.length;
  const stddev = (arr, key) => {
    const mean = avg(arr, key);
    return Math.sqrt(arr.reduce((s, m) => s + (m[key] - mean) ** 2, 0) / arr.length);
  };

  const sacAvgTput   = avg(sacMetrics, 'throughput');
  const cubicAvgTput = avg(cubicMetrics, 'throughput');
  const sacAvgRtt    = avg(sacMetrics, 'rtt');
  const cubicAvgRtt  = avg(cubicMetrics, 'rtt');
  const sacAvgLoss   = avg(sacMetrics, 'loss');
  const cubicAvgLoss = avg(cubicMetrics, 'loss');

  const sacTputStd   = stddev(sacMetrics, 'throughput');
  const cubicTputStd = stddev(cubicMetrics, 'throughput');
  const sacRttStd    = stddev(sacMetrics, 'rtt');
  const cubicRttStd  = stddev(cubicMetrics, 'rtt');

  const sacAvgAction = avg(sacMetrics, 'action');

  // SAC behavior
  let sacBehavior, sacDesc;
  if (sacAvgAction > 1.08) {
    sacBehavior = 'Aggressive';
    sacDesc = 'SAC is frequently increasing its congestion window, aggressively seeking higher throughput.';
  } else if (sacAvgAction < 0.92) {
    sacBehavior = 'Conservative';
    sacDesc = 'SAC is cautiously reducing its congestion window, prioritizing stability over throughput.';
  } else if (sacTputStd > 0.3) {
    sacBehavior = 'Adaptive';
    sacDesc = 'SAC dynamically adjusts its window size in response to changing network conditions.';
  } else {
    sacBehavior = 'Balanced';
    sacDesc = 'SAC maintains a steady congestion window, balancing throughput and latency effectively.';
  }

  // CUBIC behavior
  let cubicBehavior, cubicDesc;
  if (cubicAvgTput > sacAvgTput * 1.1) {
    cubicBehavior = 'Dominant';
    cubicDesc = 'CUBIC achieves higher throughput through its aggressive cubic growth function.';
  } else if (cubicAvgLoss > 0.05) {
    cubicBehavior = 'Struggling';
    cubicDesc = 'CUBIC experiences frequent packet loss, triggering repeated window reductions.';
  } else if (cubicTputStd < 0.2) {
    cubicBehavior = 'Steady';
    cubicDesc = 'CUBIC maintains consistent performance with predictable window growth.';
  } else {
    cubicBehavior = 'Oscillating';
    cubicDesc = 'CUBIC oscillates between growth and reduction phases as it probes bandwidth.';
  }

  // Network stability
  const avgRttStd = (sacRttStd + cubicRttStd) / 2;
  const avgLoss   = (sacAvgLoss + cubicAvgLoss) / 2;
  let stability, stabilityColor, stabilityDesc;
  if (avgRttStd < 20 && avgLoss < 0.02) {
    stability = 'Stable';
    stabilityColor = 'text-emerald-400';
    stabilityDesc = 'Network conditions are stable with low jitter and minimal packet loss.';
  } else if (avgRttStd < 50 && avgLoss < 0.05) {
    stability = 'Moderate';
    stabilityColor = 'text-yellow-400';
    stabilityDesc = 'Network shows moderate variability. Some congestion events detected.';
  } else {
    stability = 'Volatile';
    stabilityColor = 'text-red-400';
    stabilityDesc = 'Network is experiencing high variability with significant congestion events.';
  }

  // Recommendation
  let recommendation;
  const sacBetter = sacAvgTput >= cubicAvgTput && sacAvgRtt <= cubicAvgRtt;
  const cubicBetter = cubicAvgTput >= sacAvgTput && cubicAvgRtt <= sacAvgRtt;
  if (sacBetter) {
    recommendation = 'SAC is the better choice for this network — it achieves higher throughput with lower latency through RL-based adaptation.';
  } else if (cubicBetter) {
    recommendation = 'CUBIC performs better in this scenario — its proven cubic growth function handles current conditions more efficiently.';
  } else if (sacAvgRtt < cubicAvgRtt) {
    recommendation = 'SAC excels at latency optimization but trades off some throughput. Prefer SAC for latency-sensitive applications.';
  } else {
    recommendation = 'CUBIC achieves slightly lower latency. Consider SAC when network conditions are highly dynamic.';
  }

  return {
    sacBehavior, sacDesc,
    cubicBehavior, cubicDesc,
    stability, stabilityColor, stabilityDesc,
    recommendation,
    stats: { sacAvgTput, cubicAvgTput, sacAvgRtt, cubicAvgRtt },
  };
}

function InsightCard({ icon, title, badge, badgeColor, children }) {
  return (
    <div className="bg-gray-950/60 rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</span>
        </div>
        {badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-gray-400 text-xs leading-relaxed">{children}</p>
    </div>
  );
}

export default function InsightDrawer({ open, onClose, sacMetrics, cubicMetrics }) {
  const insights = useMemo(
    () => analyzeInsights(sacMetrics, cubicMetrics),
    [sacMetrics, cubicMetrics],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" />
      <div
        className="relative w-96 max-w-full h-full bg-gray-900 border-l border-gray-800 shadow-2xl overflow-y-auto animate-[slideInRight_0.25s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 p-4 flex items-center justify-between z-10">
          <h2 className="text-base font-bold text-white">🧠 Insights</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none cursor-pointer">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {!insights ? (
            <p className="text-gray-500 text-sm text-center py-12">
              Waiting for sufficient data from both algorithms...
            </p>
          ) : (
            <>
              <InsightCard
                icon="🤖"
                title="SAC Behavior"
                badge={insights.sacBehavior}
                badgeColor="bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
              >
                {insights.sacDesc}
              </InsightCard>

              <InsightCard
                icon="📐"
                title="CUBIC Behavior"
                badge={insights.cubicBehavior}
                badgeColor="bg-orange-500/15 text-orange-400 border-orange-500/30"
              >
                {insights.cubicDesc}
              </InsightCard>

              <InsightCard
                icon="🌐"
                title="Network Stability"
                badge={insights.stability}
                badgeColor={`${
                  insights.stability === 'Stable'   ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                  insights.stability === 'Moderate' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
                                                      'bg-red-500/15 text-red-400 border-red-500/30'
                }`}
              >
                {insights.stabilityDesc}
              </InsightCard>

              <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 rounded-xl p-4 border border-indigo-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">💡</span>
                  <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Recommendation</span>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed">{insights.recommendation}</p>
              </div>

              <div className="bg-gray-950/60 rounded-xl p-4 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Quick Stats</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">SAC Avg Tput</span>
                    <span className="text-indigo-300 font-mono">{insights.stats.sacAvgTput.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">CUBIC Avg Tput</span>
                    <span className="text-orange-300 font-mono">{insights.stats.cubicAvgTput.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">SAC Avg RTT</span>
                    <span className="text-indigo-300 font-mono">{insights.stats.sacAvgRtt.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">CUBIC Avg RTT</span>
                    <span className="text-orange-300 font-mono">{insights.stats.cubicAvgRtt.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
