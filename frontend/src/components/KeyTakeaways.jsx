import React, { useMemo } from 'react';

/**
 * Data-driven key takeaways. Rather than declaring a single winner, this
 * panel derives 3–5 short, neutral observations from the live averages.
 */
export default function KeyTakeaways({ sacMetrics = [], cubicMetrics = [] }) {
  const takeaways = useMemo(() => {
    return buildTakeaways(sacMetrics, cubicMetrics);
  }, [sacMetrics, cubicMetrics]);

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">📌</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
          Key Takeaways
        </h3>
        <span className="ml-auto text-[10px] text-gray-600 font-mono">
          Derived from live averages
        </span>
      </div>

      {takeaways.length === 0 ? (
        <p className="text-gray-500 text-xs py-3 text-center">
          Collecting data from both flows...
        </p>
      ) : (
        <ul className="space-y-2">
          {takeaways.map((t, i) => (
            <li key={i} className="flex gap-2 text-[12px] leading-relaxed">
              <span className={`mt-0.5 ${t.tone}`}>•</span>
              <span className="text-gray-300">{t.text}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 pt-2 border-t border-gray-800 text-[10px] text-gray-500 italic">
        Observations are trade-offs, not verdicts — efficiency and adaptability
        are both valuable goals.
      </p>
    </div>
  );
}

function buildTakeaways(sac, cubic) {
  if (sac.length < 5 || cubic.length < 5) return [];

  const avg  = (arr, k) => arr.reduce((s, m) => s + (m[k] || 0), 0) / arr.length;
  const std  = (arr, k) => {
    if (arr.length === 0) return 0;
    const m = avg(arr, k);
    const v = arr.reduce((s, x) => s + ((x[k] || 0) - m) ** 2, 0) / arr.length;
    return Math.sqrt(v);
  };

  const sacTput  = avg(sac,   'throughput');
  const cubTput  = avg(cubic, 'throughput');
  const sacRtt   = avg(sac,   'rtt');
  const cubRtt   = avg(cubic, 'rtt');
  const sacLoss  = avg(sac,   'loss');
  const cubLoss  = avg(cubic, 'loss');
  const sacTputStd = std(sac,   'throughput');
  const cubTputStd = std(cubic, 'throughput');

  const out = [];

  // Throughput story
  if (Math.abs(sacTput - cubTput) / Math.max(sacTput, cubTput, 1e-6) < 0.05) {
    out.push({
      tone: 'text-gray-400',
      text: `Throughput is essentially equal — SAC ${sacTput.toFixed(2)} Mbps vs CUBIC ${cubTput.toFixed(2)} Mbps.`,
    });
  } else if (cubTput > sacTput) {
    out.push({
      tone: 'text-orange-300',
      text: `CUBIC achieves higher throughput on average (${cubTput.toFixed(2)} vs ${sacTput.toFixed(2)} Mbps) — classic aggressive probing pays off on a steady link.`,
    });
  } else {
    out.push({
      tone: 'text-indigo-300',
      text: `SAC achieves higher throughput on average (${sacTput.toFixed(2)} vs ${cubTput.toFixed(2)} Mbps) — the learned policy is exploiting the link well.`,
    });
  }

  // Stability story (lower std = more stable)
  if (sacTputStd < cubTputStd * 0.9) {
    out.push({
      tone: 'text-indigo-300',
      text: `SAC is more stable — its throughput varies less over time (σ ${sacTputStd.toFixed(3)}) than CUBIC's (σ ${cubTputStd.toFixed(3)}).`,
    });
  } else if (cubTputStd < sacTputStd * 0.9) {
    out.push({
      tone: 'text-orange-300',
      text: `CUBIC is more stable here (σ ${cubTputStd.toFixed(3)} vs SAC σ ${sacTputStd.toFixed(3)}) — the learned policy is still exploring.`,
    });
  } else {
    out.push({
      tone: 'text-gray-400',
      text: 'Both algorithms show similar throughput stability over the observed window.',
    });
  }

  // RTT story
  if (sacRtt < cubRtt * 0.95) {
    out.push({
      tone: 'text-indigo-300',
      text: `SAC keeps RTT lower (${sacRtt.toFixed(1)} vs ${cubRtt.toFixed(1)} ms) — less queuing at the bottleneck.`,
    });
  } else if (cubRtt < sacRtt * 0.95) {
    out.push({
      tone: 'text-orange-300',
      text: `CUBIC keeps RTT lower (${cubRtt.toFixed(1)} vs ${sacRtt.toFixed(1)} ms) in this window.`,
    });
  }

  // Loss story
  if (Math.abs(sacLoss - cubLoss) > 0.005) {
    const sacBetter = sacLoss < cubLoss;
    out.push({
      tone: sacBetter ? 'text-indigo-300' : 'text-orange-300',
      text: `${sacBetter ? 'SAC' : 'CUBIC'} sees less packet loss (${(Math.min(sacLoss, cubLoss) * 100).toFixed(2)}% vs ${(Math.max(sacLoss, cubLoss) * 100).toFixed(2)}%).`,
    });
  }

  // Final trade-off line (always present)
  out.push({
    tone: 'text-amber-300',
    text: 'Trade-off: CUBIC favours efficiency via aggressive probing; SAC favours adaptability via a learned, reward-driven policy.',
  });

  return out;
}
