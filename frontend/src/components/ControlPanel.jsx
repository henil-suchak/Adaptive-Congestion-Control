import React from 'react';

const buttons = [
  { id: 'summary',  label: 'Summary',      icon: '📊', accent: 'hover:border-indigo-500/50 hover:text-indigo-300' },
  { id: 'insights', label: 'Insights',      icon: '🧠', accent: 'hover:border-violet-500/50 hover:text-violet-300' },
  { id: 'timeline', label: 'Timeline',      icon: '📍', accent: 'hover:border-emerald-500/50 hover:text-emerald-300' },
  { id: 'score',    label: 'Score Details',  icon: '📊', accent: 'hover:border-amber-500/50 hover:text-amber-300' },
];

export default function ControlPanel({ onSummary, onInsights, onTimeline, onScore }) {
  const handlers = { summary: onSummary, insights: onInsights, timeline: onTimeline, score: onScore };

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[10px] text-gray-600 uppercase tracking-wider mr-1">Analytics</span>
      {buttons.map(btn => (
        <button
          key={btn.id}
          onClick={handlers[btn.id]}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
            bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-800
            text-gray-400 transition-all cursor-pointer ${btn.accent}`}
        >
          <span>{btn.icon}</span>
          <span>{btn.label}</span>
        </button>
      ))}
    </div>
  );
}
