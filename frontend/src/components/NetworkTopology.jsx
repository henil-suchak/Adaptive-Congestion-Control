import React from 'react';

/**
 * A simple SVG diagram of the simulated path:
 *   Sender → Router → Bottleneck Link → Receiver
 *
 * Purely presentational / educational; no live data.
 */
export default function NetworkTopology() {
  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-5 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-orange-400">
          Network Topology
        </h3>
        <span className="text-[10px] text-gray-600 font-mono">
          ns-3 dumbbell (single bottleneck)
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox="0 0 820 180"
          className="w-full h-44"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#6b7280" />
            </marker>
            <linearGradient id="bottleneck" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Connecting lines */}
          <line x1="110" y1="90" x2="290" y2="90" stroke="#374151" strokeWidth="2" markerEnd="url(#arrow)" />
          <line x1="390" y1="90" x2="570" y2="90" stroke="url(#bottleneck)" strokeWidth="6" />
          <line x1="570" y1="90" x2="710" y2="90" stroke="#374151" strokeWidth="2" markerEnd="url(#arrow)" />

          {/* Sender */}
          <g>
            <rect x="20" y="55" width="90" height="70" rx="10" fill="#111827" stroke="#818cf8" strokeWidth="1.5" />
            <text x="65" y="85" textAnchor="middle" fill="#a5b4fc" fontSize="12" fontWeight="600">Sender</text>
            <text x="65" y="105" textAnchor="middle" fill="#6b7280" fontSize="10">TCP flow</text>
          </g>

          {/* Router */}
          <g>
            <rect x="290" y="55" width="100" height="70" rx="10" fill="#111827" stroke="#4b5563" strokeWidth="1.5" />
            <text x="340" y="85" textAnchor="middle" fill="#e5e7eb" fontSize="12" fontWeight="600">Router</text>
            <text x="340" y="105" textAnchor="middle" fill="#6b7280" fontSize="10">queue / AQM</text>
          </g>

          {/* Bottleneck label */}
          <text x="480" y="75" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="600">
            Bottleneck link
          </text>
          <text x="480" y="115" textAnchor="middle" fill="#6b7280" fontSize="10">
            2 Mbps · 80 ms RTT
          </text>

          {/* Receiver */}
          <g>
            <rect x="710" y="55" width="90" height="70" rx="10" fill="#111827" stroke="#fb923c" strokeWidth="1.5" />
            <text x="755" y="85" textAnchor="middle" fill="#fdba74" fontSize="12" fontWeight="600">Receiver</text>
            <text x="755" y="105" textAnchor="middle" fill="#6b7280" fontSize="10">ACKs back</text>
          </g>
        </svg>
      </div>

      <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
        The congestion-control algorithm runs at the <span className="text-indigo-300">Sender</span> and
        reacts to feedback (RTT, losses, ACKs) to decide how much data it is allowed to keep in
        flight. The <span className="text-amber-300">bottleneck link</span> between the routers is the
        shared resource both SAC and CUBIC must learn to share efficiently.
      </p>
    </div>
  );
}
