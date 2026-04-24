import React, { useState } from 'react';

/**
 * Content dictionary for each metric / concept the dashboard surfaces.
 * Add new entries here as more graphs gain an Explain button.
 */
export const EXPLAIN_CONTENT = {
  rtt: {
    title: 'RTT — Round-Trip Time',
    accent: 'text-emerald-300',
    summary: 'Time for a packet to travel from sender → receiver → back.',
    bullets: [
      'Measured in milliseconds (ms). Lower is better.',
      'Increases when routers queue packets (congestion).',
      'A sudden RTT spike is often the first sign of a bottleneck filling up.',
      'Base RTT here is ~80 ms — values well above that indicate queuing delay.',
    ],
  },
  throughput: {
    title: 'Throughput — Useful Data Rate',
    accent: 'text-indigo-300',
    summary: 'How much useful data the flow is moving through the link.',
    bullets: [
      'Measured in Mbps (million bits per second). Higher is better.',
      'Capped by the bottleneck — 2 Mbps in this simulation.',
      'Good congestion control aims to stay close to 2 Mbps without overshooting.',
      'Throughput that oscillates hard usually means the algorithm is overshooting and losing.',
    ],
  },
  cwnd: {
    title: 'cWnd — Congestion Window',
    accent: 'text-violet-300',
    summary: 'The amount of data the sender is allowed to keep in flight.',
    bullets: [
      'cWnd is the key knob congestion-control algorithms move.',
      'Larger cWnd = more data on the wire = potentially more throughput.',
      'If cWnd grows too large, queues overflow and packets are lost.',
      'The shape of cWnd reveals the algorithm\'s strategy (ramp-up, sawtooth, plateau).',
    ],
  },
  reward: {
    title: 'Reward — SAC Training Signal',
    accent: 'text-amber-300',
    summary: 'Scalar feedback the RL agent uses to learn a policy.',
    bullets: [
      'Shaped from throughput, RTT, and loss at each step.',
      'Positive reward → current action improved the network state.',
      'Negative reward → the action was counterproductive (e.g., induced loss).',
      'Over training, a well-behaved agent\'s average reward trends upward.',
    ],
  },
  comparison: {
    title: 'Comparison Panel',
    accent: 'text-orange-300',
    summary: 'Aggregated, weighted comparison of SAC vs CUBIC over recent samples.',
    bullets: [
      'Weighted score: 45% throughput, 35% RTT, 20% loss.',
      'Improvement rows show percentage differences per metric.',
      'Link utilisation tells you how close each flow got to the 2 Mbps ceiling.',
      'Use it to understand trade-offs — it is not a strict winner declaration.',
    ],
  },
  phases: {
    title: 'CWND Phases',
    accent: 'text-sky-300',
    summary: 'Approximate labelling of the three canonical TCP congestion phases.',
    bullets: [
      'Slow Start: rapid (>20% per sample) growth of cWnd.',
      'Congestion Avoidance: gentle growth (≤20% per sample).',
      'Loss Recovery: cWnd drops below 80% of its previous value.',
      'Detection is heuristic — inferred from the cWnd samples only.',
    ],
  },
  topology: {
    title: 'Network Topology',
    accent: 'text-cyan-300',
    summary: 'The simulated path every flow travels.',
    bullets: [
      'Sender → Router → Bottleneck link → Router → Receiver.',
      'Bottleneck: 2 Mbps, ~80 ms base RTT.',
      'The router queue is where congestion manifests.',
      'Both SAC and CUBIC share the same topology for a fair comparison.',
    ],
  },
};

/**
 * Small info button that opens a modal describing a metric/concept.
 * Usage: <ExplainButton metric="rtt" />
 */
export function ExplainButton({ metric, className = '' }) {
  const [open, setOpen] = useState(false);
  const content = EXPLAIN_CONTENT[metric];
  if (!content) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-700 bg-gray-950/60 hover:border-indigo-500 hover:bg-gray-900 text-[10px] uppercase tracking-wider text-gray-300 transition-all ${className}`}
      >
        <span className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300 text-[9px]">i</span>
        Explain
      </button>
      <ExplainModal open={open} metric={metric} onClose={() => setOpen(false)} />
    </>
  );
}

export default function ExplainModal({ open, metric, onClose }) {
  if (!open) return null;
  const content = EXPLAIN_CONTENT[metric];
  if (!content) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className={`text-lg font-bold ${content.accent}`}>{content.title}</h3>
            <p className="text-sm text-gray-400 mt-1">{content.summary}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg border border-gray-800 hover:border-gray-600 text-gray-500 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>

        <ul className="space-y-2 mt-4">
          {content.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-gray-300 leading-relaxed">
              <span className="text-indigo-400 mt-0.5">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 pt-4 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
