import React from 'react';

const TABS = [
  { id: 'SAC', label: 'SAC Model', hint: 'Reinforcement-learning agent' },
  { id: 'CUBIC', label: 'TCP CUBIC', hint: 'Classic loss-based control' },
  { id: 'COMPARE', label: 'Comparison', hint: 'Side-by-side performance' },
];

export default function TabNav({
  active,
  onChange,
  connected,
  learningMode,
  onToggleLearning,
  canStartTour,
  onStartTour,
}) {
  return (
    <div className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-400 to-orange-400" />
          <span className="text-sm font-semibold bg-gradient-to-r from-indigo-400 via-violet-400 to-orange-400 bg-clip-text text-transparent">
            Adaptive Congestion Control · Learning Dashboard
          </span>
        </div>

        <nav className="flex items-center bg-gray-900 rounded-lg border border-gray-800 p-0.5">
          {TABS.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                title={t.hint}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {/* Start Tour */}
          <button
            type="button"
            onClick={onStartTour}
            disabled={!canStartTour}
            title={
              canStartTour
                ? 'Start a guided tour of this page'
                : 'No tour available for this view'
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-800 bg-gray-900 hover:border-indigo-500 hover:bg-gray-800 text-xs text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <span className="text-[11px]">🎓</span>
            <span>Guided Tour</span>
          </button>

          {/* Learning Mode toggle */}
          <LearningToggle active={learningMode} onToggle={onToggleLearning} />

          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-gray-400">
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LearningToggle({ active, onToggle }) {
  return (
    <div
      className="flex items-center bg-gray-900 rounded-lg border border-gray-800 p-0.5"
      title="Learning mode shows explain buttons, tooltips, and phase labels"
    >
      <button
        onClick={() => onToggle(false)}
        className={`px-2.5 py-1 text-[11px] rounded-md transition-all ${
          !active
            ? 'bg-gray-700 text-white shadow'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        Normal
      </button>
      <button
        onClick={() => onToggle(true)}
        className={`px-2.5 py-1 text-[11px] rounded-md transition-all ${
          active
            ? 'bg-indigo-600 text-white shadow'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        Learning
      </button>
    </div>
  );
}
