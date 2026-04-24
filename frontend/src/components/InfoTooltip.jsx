import React, { useState } from 'react';

/**
 * Small info icon with a hover/focus tooltip. Used on learning pages to
 * surface metric explanations without cluttering the dashboard.
 */
export default function InfoTooltip({ text, className = '' }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="More info"
        className="w-4 h-4 inline-flex items-center justify-center rounded-full border border-gray-700 bg-gray-900 text-[10px] text-gray-400 hover:text-white hover:border-indigo-500 transition-colors"
      >
        i
      </button>
      {open && (
        <span className="absolute left-1/2 -translate-x-1/2 top-6 z-50 w-56 p-2 text-[11px] leading-snug rounded-lg border border-gray-700 bg-gray-950/95 text-gray-200 shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}
