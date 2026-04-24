import React, { useEffect, useState } from 'react';

/**
 * Lightweight guided-tour overlay.
 *
 * Usage:
 *   <GuidedTour
 *     active={tourActive}
 *     onClose={() => setTourActive(false)}
 *     steps={[
 *       { anchorId: 'tour-rtt',        title: 'RTT Graph',        body: 'Shows network delay.' },
 *       { anchorId: 'tour-throughput', title: 'Throughput Graph', body: 'Shows data transfer rate.' },
 *     ]}
 *   />
 *
 * Pages add `id="tour-rtt"` etc. to the DOM elements they want highlighted.
 */
export default function GuidedTour({ active, steps, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (active) setI(0);
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const step = steps[i];
    if (!step) return undefined;

    const el = document.getElementById(step.anchorId);
    if (!el) {
      setRect(null);
      return undefined;
    }

    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) { /* older browsers */ }

    const update = () => setRect(el.getBoundingClientRect());
    update();

    const id = window.setInterval(update, 150);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, i, steps]);

  if (!active) return null;
  const step = steps[i];
  const total = steps.length;

  const next = () => {
    if (i < total - 1) setI(i + 1);
    else onClose();
  };
  const prev = () => {
    if (i > 0) setI(i - 1);
  };

  // Tooltip placement: below the rect, but flip above if there's no room.
  let tooltipStyle;
  if (rect) {
    const below = window.innerHeight - rect.bottom > 240;
    tooltipStyle = {
      position: 'fixed',
      top: below ? rect.bottom + 16 : Math.max(16, rect.top - 240),
      left: Math.max(16, Math.min(window.innerWidth - 376, rect.left)),
      width: 360,
      zIndex: 80,
    };
  } else {
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 360,
      zIndex: 80,
    };
  }

  return (
    <>
      {/* Spotlight + dim backdrop */}
      {rect ? (
        <div
          style={{
            position: 'fixed',
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            border: '2px solid #818cf8',
            borderRadius: 14,
            boxShadow:
              '0 0 40px rgba(129,140,248,0.55), 0 0 0 9999px rgba(0,0,0,0.55)',
            pointerEvents: 'none',
            zIndex: 75,
            transition: 'all 180ms ease',
          }}
        />
      ) : (
        <div
          className="fixed inset-0 bg-black/55"
          style={{ zIndex: 75, pointerEvents: 'auto' }}
          onClick={onClose}
        />
      )}

      {/* Tooltip card */}
      <div
        style={tooltipStyle}
        className="bg-gray-900 border border-indigo-500/40 rounded-xl shadow-2xl p-4 text-sm"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">
              Step {i + 1} of {total}
            </p>
            <h4 className="text-base font-bold text-white mt-0.5">
              {step?.title || 'Tour'}
            </h4>
          </div>
          <button
            onClick={onClose}
            aria-label="End tour"
            className="w-7 h-7 rounded-md border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 text-sm"
          >
            ×
          </button>
        </div>
        <p className="text-[13px] text-gray-300 leading-relaxed">
          {step?.body}
        </p>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">
          <div className="flex gap-1">
            {steps.map((_, idx) => (
              <span
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === i ? 'bg-indigo-400' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-2.5 py-1 text-[11px] rounded-md text-gray-400 hover:text-white"
            >
              Skip
            </button>
            <button
              onClick={prev}
              disabled={i === 0}
              className="px-2.5 py-1 text-[11px] rounded-md border border-gray-700 text-gray-300 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              onClick={next}
              className="px-2.5 py-1 text-[11px] rounded-md bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {i === total - 1 ? 'Finish' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
