import React, { useCallback, useMemo, useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, ReferenceArea, ReferenceDot,
} from 'recharts';
import {
  detectEvents,
  EventMarkerShape,
  EventsToggle,
  EventTimeline,
} from './EventOverlay';
import EventTooltip from './EventTooltip';

/**
 * CWND visualization with per-sample phase detection.
 *
 * Phase rule (per user spec):
 *   for i >= 1:
 *     growth = (curr - prev) / prev
 *     if curr < prev * 0.8      → LOSS_RECOVERY
 *     else if growth > 0.2      → SLOW_START
 *     else                      → CONGESTION_AVOIDANCE
 *
 * Colours:
 *   Slow Start          → green
 *   Congestion Avoid.   → blue
 *   Loss Recovery       → red
 */

const PHASE_META = {
  SLOW_START:           { label: 'Slow Start',           color: '#34d399' },
  CONGESTION_AVOIDANCE: { label: 'Congestion Avoidance', color: '#60a5fa' },
  LOSS_RECOVERY:        { label: 'Loss Recovery',        color: '#f87171' },
};

export default function CwndPhaseChart({
  metrics,
  accentColor = '#fb923c',
  title = 'Congestion Window (cWnd) — Phase View',
}) {
  const { data, runs } = useMemo(() => analysePhases(metrics), [metrics]);

  const [showEvents, setShowEvents] = useState(true);
  const [hovered, setHovered] = useState(null);

  const events = useMemo(
    () => (showEvents ? detectEvents(metrics, { maxMarkers: 10 }) : []),
    [metrics, showEvents],
  );

  const handleHover = useCallback((event, x, y) => {
    setHovered({ event, x, y });
  }, []);
  const handleLeave = useCallback(() => setHovered(null), []);

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider">
          {title}
        </h3>
        <div className="flex items-center gap-3 text-[10px] flex-wrap">
          <LegendSwatch color={PHASE_META.SLOW_START.color}           label="Slow Start" />
          <LegendSwatch color={PHASE_META.CONGESTION_AVOIDANCE.color} label="Cong. Avoidance" />
          <LegendSwatch color={PHASE_META.LOSS_RECOVERY.color}        label="Loss Recovery" />
          <EventsToggle
            active={showEvents}
            onChange={setShowEvents}
            count={events.length}
          />
        </div>
      </div>

      {/* Inline phase-label ribbon above the chart */}
      <div className="relative h-5 mb-1 bg-gray-950/40 rounded-md overflow-hidden border border-gray-800">
        {data.length > 1 && runs.map((r, idx) => {
          const left = (r.start / (data.length - 1)) * 100;
          const width = ((r.end - r.start) / (data.length - 1)) * 100;
          if (width < 2) return null;
          return (
            <div
              key={idx}
              className="absolute top-0 bottom-0 flex items-center justify-center text-[9px] font-semibold uppercase tracking-wider"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: `${PHASE_META[r.phase].color}22`,
                color: PHASE_META[r.phase].color,
                borderRight: '1px solid rgba(255,255,255,0.04)',
              }}
              title={PHASE_META[r.phase].label}
            >
              {width > 8 ? PHASE_META[r.phase].label : ''}
            </div>
          );
        })}
      </div>

      {data.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-gray-500 text-xs">
          Waiting for samples...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cwnd-phase-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={accentColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="idx"
              tick={{ fontSize: 9, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#1f2937' }}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#6b7280' }}
              width={50}
              unit=" KB"
              tickLine={false}
              axisLine={{ stroke: '#1f2937' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111827',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '11px',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
              formatter={(v, _n, entry) => {
                const p = entry?.payload?.phase;
                const phaseLabel = p ? PHASE_META[p].label : '';
                return [`${Number(v).toFixed(2)} KB${phaseLabel ? ` · ${phaseLabel}` : ''}`, 'cWnd'];
              }}
            />

            {/* Shaded background per phase run */}
            {runs.map((r, idx) => (
              <ReferenceArea
                key={idx}
                x1={r.start}
                x2={r.end}
                fill={PHASE_META[r.phase].color}
                fillOpacity={0.07}
                stroke={PHASE_META[r.phase].color}
                strokeOpacity={0.25}
                strokeDasharray="3 3"
              />
            ))}

            <Area
              type="monotone"
              dataKey="cwnd"
              stroke={accentColor}
              fill="url(#cwnd-phase-grad)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />

            {/* Event markers overlaid on the CWND line */}
            {showEvents && events.map((e) => (
              <ReferenceDot
                key={`evt-${e.index}-${e.type}`}
                x={e.index}
                y={e.cwnd}
                r={0}
                ifOverflow="extendDomain"
                shape={(props) => (
                  <EventMarkerShape
                    cx={props.cx}
                    cy={props.cy}
                    event={e}
                    onHover={handleHover}
                    onLeave={handleLeave}
                  />
                )}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Floating tooltip for the currently hovered marker */}
      {hovered && (
        <EventTooltip
          event={hovered.event}
          x={hovered.x}
          y={hovered.y}
        />
      )}

      {/* Event timeline below the graph (only when events are visible) */}
      {showEvents && <EventTimeline events={events} />}

      {/* Legend cards */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <PhaseLegend
          title="Slow Start"
          color="text-emerald-400"
          body="cWnd grows by more than 20% per sample — rapid ramp-up typical of slow-start / probe phases."
        />
        <PhaseLegend
          title="Congestion Avoidance"
          color="text-blue-400"
          body="Gentle growth (≤20% per sample). The sender is carefully probing the link's capacity."
        />
        <PhaseLegend
          title="Loss Recovery"
          color="text-red-400"
          body="cWnd dropped to less than 80% of the previous sample — typical reaction to a loss signal."
        />
      </div>

      <p className="mt-2 text-[10px] text-gray-500 italic">
        Note: phase detection is approximate — it is inferred from cWnd trends
        per sample and does not read kernel state.
      </p>
    </div>
  );
}

function LegendSwatch({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-gray-500">{label}</span>
    </span>
  );
}

function PhaseLegend({ title, color, body }) {
  return (
    <div className="bg-gray-950/40 rounded-lg p-2 border border-gray-800">
      <p className={`font-semibold ${color}`}>{title}</p>
      <p className="text-gray-500 leading-snug mt-0.5">{body}</p>
    </div>
  );
}

/**
 * Applies the per-sample phase rule and compresses consecutive same-phase
 * indices into "runs" used to draw shaded ReferenceAreas and labels.
 */
function analysePhases(metrics) {
  const data = (metrics || []).map((m, i) => ({
    idx: i,
    cwnd: m.cwnd || 0,
    phase: null,
  }));

  if (data.length === 0) return { data, runs: [] };

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1].cwnd;
    const curr = data[i].cwnd;
    if (prev <= 0) {
      data[i].phase = 'SLOW_START';
      continue;
    }
    const growthRate = (curr - prev) / prev;
    if (curr < prev * 0.8)      data[i].phase = 'LOSS_RECOVERY';
    else if (growthRate > 0.2)  data[i].phase = 'SLOW_START';
    else                        data[i].phase = 'CONGESTION_AVOIDANCE';
  }
  data[0].phase = data[1]?.phase || 'SLOW_START';

  const runs = [];
  let runStart = 0;
  for (let i = 1; i <= data.length; i++) {
    if (i === data.length || data[i].phase !== data[runStart].phase) {
      runs.push({
        start: runStart,
        end: i - 1,
        phase: data[runStart].phase,
      });
      runStart = i;
    }
  }

  return { data, runs };
}
