import React, { useMemo } from 'react';

const WINDOW = 8;

function detectPhases(metrics) {
  if (metrics.length < WINDOW) return [];

  const phases = [];
  let i = 0;

  while (i + WINDOW <= metrics.length) {
    const window = metrics.slice(i, i + WINDOW);
    const avgRtt  = window.reduce((s, m) => s + (m.rtt || 0), 0) / WINDOW;
    const avgLoss = window.reduce((s, m) => s + (m.loss || 0), 0) / WINDOW;
    const avgTput = window.reduce((s, m) => s + (m.throughput || 0), 0) / WINDOW;

    let phase, color, icon;
    if (avgLoss > 0.04 || avgRtt > 150) {
      phase = 'Congestion';
      color = 'border-red-500/40 bg-red-500/10';
      icon = '🔴';
    } else if (
      phases.length > 0 &&
      phases[phases.length - 1].phase === 'Congestion' &&
      avgRtt < 130 &&
      avgLoss < 0.04
    ) {
      phase = 'Recovery';
      color = 'border-amber-500/40 bg-amber-500/10';
      icon = '🟡';
    } else {
      phase = 'Stable';
      color = 'border-emerald-500/40 bg-emerald-500/10';
      icon = '🟢';
    }

    const last = phases[phases.length - 1];
    if (last && last.phase === phase) {
      last.end = i + WINDOW - 1;
      last.endTime = window[WINDOW - 1].time;
    } else {
      phases.push({
        phase,
        color,
        icon,
        start: i,
        end: i + WINDOW - 1,
        startTime: window[0].time,
        endTime: window[WINDOW - 1].time,
        avgRtt: avgRtt.toFixed(1),
        avgTput: avgTput.toFixed(4),
        avgLoss: (avgLoss * 100).toFixed(2),
      });
    }
    i += WINDOW;
  }

  return phases;
}

function PhaseCard({ phase }) {
  return (
    <div className={`rounded-lg p-3 border ${phase.color}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{phase.icon}</span>
          <span className="text-xs font-semibold text-white">{phase.phase}</span>
        </div>
        <span className="text-[10px] text-gray-500 font-mono">
          Steps {phase.start}–{phase.end}
        </span>
      </div>
      <div className="text-[10px] text-gray-500 mb-2">
        {phase.startTime} → {phase.endTime}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <span className="text-gray-500 block">Avg RTT</span>
          <span className="text-gray-300 font-mono">{phase.avgRtt} ms</span>
        </div>
        <div>
          <span className="text-gray-500 block">Avg Tput</span>
          <span className="text-gray-300 font-mono">{phase.avgTput}</span>
        </div>
        <div>
          <span className="text-gray-500 block">Avg Loss</span>
          <span className="text-gray-300 font-mono">{phase.avgLoss}%</span>
        </div>
      </div>
    </div>
  );
}

export default function TimelineDrawer({ open, onClose, sacMetrics, cubicMetrics }) {
  const sacPhases   = useMemo(() => detectPhases(sacMetrics), [sacMetrics]);
  const cubicPhases = useMemo(() => detectPhases(cubicMetrics), [cubicMetrics]);

  if (!open) return null;

  const noData = sacPhases.length === 0 && cubicPhases.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" />
      <div
        className="relative w-[420px] max-w-full h-full bg-gray-900 border-l border-gray-800 shadow-2xl overflow-y-auto animate-[slideInRight_0.25s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 p-4 flex items-center justify-between z-10">
          <h2 className="text-base font-bold text-white">📍 Timeline</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none cursor-pointer">✕</button>
        </div>

        <div className="p-4 space-y-5">
          {noData ? (
            <p className="text-gray-500 text-sm text-center py-12">
              Need more data to detect network phases...
            </p>
          ) : (
            <>
              {/* Legend */}
              <div className="flex items-center gap-4 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span>🟢</span> Stable</span>
                <span className="flex items-center gap-1"><span>🔴</span> Congestion</span>
                <span className="flex items-center gap-1"><span>🟡</span> Recovery</span>
              </div>

              {/* SAC Timeline */}
              {sacPhases.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
                    SAC Timeline
                  </h3>
                  <div className="space-y-2">
                    {sacPhases.map((p, i) => <PhaseCard key={i} phase={p} />)}
                  </div>
                </div>
              )}

              {/* CUBIC Timeline */}
              {cubicPhases.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-orange-400 mb-3">
                    CUBIC Timeline
                  </h3>
                  <div className="space-y-2">
                    {cubicPhases.map((p, i) => <PhaseCard key={i} phase={p} />)}
                  </div>
                </div>
              )}

              {/* Phase Summary */}
              <div className="bg-gray-950/60 rounded-xl p-4 border border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Phase Summary</p>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <p className="text-indigo-400 font-semibold mb-1">SAC</p>
                    <PhaseCount phases={sacPhases} />
                  </div>
                  <div>
                    <p className="text-orange-400 font-semibold mb-1">CUBIC</p>
                    <PhaseCount phases={cubicPhases} />
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

function PhaseCount({ phases }) {
  const counts = { Stable: 0, Congestion: 0, Recovery: 0 };
  phases.forEach(p => { counts[p.phase] = (counts[p.phase] || 0) + 1; });
  return (
    <div className="space-y-1 text-gray-400">
      <div className="flex justify-between"><span>🟢 Stable</span><span className="font-mono">{counts.Stable}</span></div>
      <div className="flex justify-between"><span>🔴 Congestion</span><span className="font-mono">{counts.Congestion}</span></div>
      <div className="flex justify-between"><span>🟡 Recovery</span><span className="font-mono">{counts.Recovery}</span></div>
    </div>
  );
}
