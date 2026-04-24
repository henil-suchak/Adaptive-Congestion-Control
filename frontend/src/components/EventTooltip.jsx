import React from 'react';
import { EVENT_META } from './EventOverlay';

/**
 * Floating tooltip rendered when an event marker is hovered.
 * Positioned in screen-space (clientX/clientY) so it works regardless of
 * the chart's own coordinate system.
 */
export default function EventTooltip({ event, x, y }) {
  if (!event) return null;
  const meta = EVENT_META[event.type];
  if (!meta) return null;

  const OFFSET_X = 14;
  const OFFSET_Y = -12;
  const WIDTH = 240;

  const left = Math.min(
    Math.max(8, x + OFFSET_X),
    (typeof window !== 'undefined' ? window.innerWidth : 1200) - WIDTH - 8,
  );
  const top = Math.max(8, y + OFFSET_Y);

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[90] rounded-lg border shadow-2xl bg-gray-950/95 backdrop-blur-sm"
      style={{
        top,
        left,
        width: WIDTH,
        borderColor: `${meta.color}55`,
        boxShadow: `0 0 18px ${meta.color}22`,
        transition: 'top 80ms ease, left 80ms ease',
      }}
    >
      <div
        className="px-2.5 py-1 rounded-t-lg text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
        style={{
          backgroundColor: `${meta.color}22`,
          color: meta.color,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: meta.color }}
        />
        <span>{meta.label}</span>
        <span className="ml-auto text-gray-500 font-mono">
          step {event.index}
        </span>
      </div>
      <div className="p-2.5">
        <p className="text-[12px] text-gray-200 leading-relaxed">
          {event.message}
        </p>
        <div className="mt-2 pt-2 border-t border-gray-800 grid grid-cols-2 gap-1 text-[10px] font-mono">
          <div>
            <span className="text-gray-500">cWnd</span>{' '}
            <span className="text-gray-200">
              {Number(event.cwnd ?? 0).toFixed(2)} KB
            </span>
          </div>
          <div>
            <span className="text-gray-500">Δ</span>{' '}
            <span
              style={{
                color:
                  event.growthRate > 0
                    ? '#34d399'
                    : event.growthRate < 0
                    ? '#f87171'
                    : '#9ca3af',
              }}
            >
              {event.growthRate >= 0 ? '+' : ''}
              {(event.growthRate * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
