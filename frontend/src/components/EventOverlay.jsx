import React from 'react';

/**
 * Event-based explanation system for the CWND graph.
 *
 * The detection rule mirrors the phase rule (per-sample growth):
 *   if curr < prev * 0.8       → LOSS
 *   else if growth > 0.2       → SLOW_START
 *   else                       → AVOIDANCE
 *
 * To avoid visual clutter the raw per-sample events are collapsed to
 * "phase transitions" (first sample of each new run), which naturally
 * produces a handful of markers. If still more than `maxMarkers`, the
 * list is prioritised (LOSS always kept, most recent transitions first).
 */

export const EVENT_META = {
  LOSS: {
    label: 'LOSS',
    color: '#ef4444',
    message: '⚠ Packet loss detected → CWND reduced to control congestion',
  },
  SLOW_START: {
    label: 'SLOW START',
    color: '#10b981',
    message: '🚀 Slow Start → CWND increasing rapidly',
  },
  AVOIDANCE: {
    label: 'AVOIDANCE',
    color: '#3b82f6',
    message: '📈 Congestion Avoidance → probing network capacity',
  },
};

/**
 * Classify each sample by the rule, then compress consecutive same-type
 * samples so only phase transitions survive. Returns an array of events:
 *   { index, type, cwnd, message, growthRate }
 */
export function detectEvents(metrics, { maxMarkers = 10 } = {}) {
  if (!metrics || metrics.length < 2) return [];

  // Step 1: classify every sample.
  const classified = [];
  for (let i = 1; i < metrics.length; i++) {
    const prev = metrics[i - 1]?.cwnd || 0;
    const curr = metrics[i]?.cwnd || 0;
    if (prev <= 0) continue;

    const growthRate = (curr - prev) / prev;
    let type;
    if (curr < prev * 0.8)      type = 'LOSS';
    else if (growthRate > 0.2)  type = 'SLOW_START';
    else                        type = 'AVOIDANCE';

    classified.push({ index: i, type, cwnd: curr, growthRate });
  }

  if (classified.length === 0) return [];

  // Step 2: keep only the first sample of each run (transition points),
  //         plus every LOSS because losses are always interesting.
  const transitions = [];
  let prevType = null;
  for (const e of classified) {
    if (e.type === 'LOSS' || e.type !== prevType) {
      transitions.push(e);
    }
    prevType = e.type;
  }

  // Step 3: cap to maxMarkers. Keep all LOSS; for the others, keep the most
  //         recent transitions so the live tail is always labelled.
  let trimmed = transitions;
  if (transitions.length > maxMarkers) {
    const losses = transitions.filter((e) => e.type === 'LOSS');
    const others = transitions.filter((e) => e.type !== 'LOSS');

    const remaining = Math.max(0, maxMarkers - losses.length);
    const recentOthers = others.slice(-remaining);
    trimmed = [...losses, ...recentOthers].sort((a, b) => a.index - b.index);
  }

  // Attach the canonical message.
  return trimmed.map((e) => ({
    ...e,
    message: EVENT_META[e.type].message,
  }));
}

/**
 * Custom recharts shape used by <ReferenceDot>. Renders a coloured dot
 * with a soft halo and wires up hover handlers that report the event
 * and screen-space position back to the parent chart.
 */
export function EventMarkerShape({
  cx, cy, event, onHover, onLeave,
}) {
  if (cx == null || cy == null || !event) return null;
  const color = EVENT_META[event.type]?.color || '#9ca3af';

  return (
    <g style={{ cursor: 'pointer' }}>
      {/* Soft outer halo */}
      <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.15} />
      <circle cx={cx} cy={cy} r={6} fill={color} fillOpacity={0.35} />
      {/* Visible marker + hover hit-target */}
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill={color}
        stroke="#0b0f1a"
        strokeWidth={1.5}
        onMouseEnter={(e) => onHover?.(event, e.clientX, e.clientY)}
        onMouseMove={(e) => onHover?.(event, e.clientX, e.clientY)}
        onMouseLeave={() => onLeave?.()}
      />
    </g>
  );
}

/**
 * Small "Show Events" pill used in the CWND chart header.
 */
export function EventsToggle({ active, onChange, count }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] uppercase tracking-wider transition-colors ${
        active
          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25'
          : 'border-gray-700 bg-gray-950/60 text-gray-400 hover:text-white hover:border-gray-500'
      }`}
      title={active ? 'Hide event markers' : 'Show event markers'}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active ? 'bg-indigo-400 animate-pulse' : 'bg-gray-600'
        }`}
      />
      <span>{active ? 'Events On' : 'Show Events'}</span>
      {active && count > 0 && (
        <span className="text-[9px] text-indigo-200 font-mono">· {count}</span>
      )}
    </button>
  );
}

/**
 * Compact event timeline rendered below the chart.
 */
export function EventTimeline({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="mt-3 bg-gray-950/40 rounded-lg p-3 border border-gray-800 text-[11px] text-gray-500">
        Events will appear here once the CWND data shows a phase transition.
      </div>
    );
  }

  return (
    <div className="mt-3 bg-gray-950/40 rounded-lg p-3 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
          Event Timeline
        </h4>
        <span className="text-[10px] text-gray-600 font-mono">
          {events.length} event{events.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
        {events.map((e) => {
          const meta = EVENT_META[e.type];
          return (
            <li
              key={`${e.index}-${e.type}`}
              className="flex items-center gap-2 text-[11px]"
            >
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: meta.color }}
              />
              <span className="text-gray-500 font-mono w-14 flex-shrink-0">
                Step {e.index}
              </span>
              <span
                className="font-semibold flex-shrink-0 w-20"
                style={{ color: meta.color }}
              >
                {meta.label}
              </span>
              <span className="text-gray-400 truncate">{e.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
