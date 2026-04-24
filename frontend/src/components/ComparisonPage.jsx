import React from 'react';
import Dashboard from './Dashboard';
import InfoTooltip from './InfoTooltip';
import KeyTakeaways from './KeyTakeaways';
import PersonalityCards from './PersonalityCards';
import { ExplainButton } from './ExplainModal';

/**
 * Comparison tab — reuses the existing Dashboard exactly, wrapped in a
 * "Performance Comparison" framing that de-emphasizes the single-winner
 * narrative and surfaces Key Takeaways + Algorithm Personality cards.
 */
export default function ComparisonPage({
  sacMetrics = [],
  cubicMetrics = [],
  learningMode = true,
}) {
  return (
    <div>
      <div className="max-w-[1600px] mx-auto px-6 pt-6 space-y-4">
        {/* Framing banner — pushes the 'winner' panel out of the page title */}
        <div
          id="tour-compare-banner"
          className="bg-gradient-to-r from-indigo-900/30 via-gray-900 to-orange-900/30 border border-gray-800 rounded-xl p-4 relative"
        >
          {learningMode && (
            <div className="absolute top-3 right-3">
              <ExplainButton metric="comparison" />
            </div>
          )}
          <div className="flex items-start justify-between gap-4 flex-wrap pr-24">
            <div>
              <h2 className="text-xl font-bold text-gray-100">
                Performance Comparison
              </h2>
              <p className="text-[12px] text-gray-400 mt-1 max-w-3xl leading-relaxed">
                The goal of this view is not to crown a winner but to
                understand <span className="text-indigo-300">how</span> the two
                algorithms differ across RTT, throughput, congestion window,
                packet loss, and reward. Look for steady-state behaviour,
                responsiveness to loss, and link-utilisation trade-offs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Legend color="#818cf8" label="SAC (RL)" tip="Soft Actor-Critic — learned policy that scales cWnd each step." />
              <Legend color="#fb923c" label="CUBIC" tip="Loss-based classic TCP; cubic growth of cWnd since last loss." />
            </div>
          </div>

          {learningMode && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <MetricLegend name="RTT"        desc="Round-trip time. Lower is better — indicates less queuing delay at the bottleneck." />
              <MetricLegend name="Throughput" desc="Useful data per second. Higher is better, bounded by the 2 Mbps bottleneck." />
              <MetricLegend name="cWnd"       desc="Bytes in flight the sender is allowed. Shape reveals the algorithm's strategy." />
              <MetricLegend name="Packet Loss" desc="Fraction of packets dropped. Lower is better; high loss signals aggressive sending." />
            </div>
          )}
        </div>

        {/* Key Takeaways + Personality Cards side-by-side on wide screens */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div id="tour-compare-takeaways" className="lg:col-span-2">
            <KeyTakeaways sacMetrics={sacMetrics} cubicMetrics={cubicMetrics} />
          </div>
          <div id="tour-compare-personas" className="lg:col-span-3">
            <PersonalityCards />
          </div>
        </div>
      </div>

      {/* The existing dashboard, unchanged */}
      <Dashboard />
    </div>
  );
}

function Legend({ color, label, tip }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-gray-950/60 border border-gray-800 rounded-full px-2.5 py-1">
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-gray-200 font-medium">{label}</span>
      <InfoTooltip text={tip} />
    </span>
  );
}

function MetricLegend({ name, desc }) {
  return (
    <div className="bg-gray-950/40 border border-gray-800 rounded-lg px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-200 font-semibold">{name}</span>
        <InfoTooltip text={desc} />
      </div>
      <p className="text-gray-500 leading-snug mt-0.5">{desc}</p>
    </div>
  );
}
