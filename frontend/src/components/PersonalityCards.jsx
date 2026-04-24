import React from 'react';

/**
 * Two compact "personality" cards describing the character of each
 * algorithm at a glance.
 */
export default function PersonalityCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PersonaCard
        name="SAC"
        subtitle="Soft Actor-Critic"
        emoji="🤖"
        accent="indigo"
        tagline="Learns from experience."
        traits={[
          { label: 'Learning-based',   tone: 'bg-indigo-500/20 text-indigo-300' },
          { label: 'Stable',           tone: 'bg-emerald-500/20 text-emerald-300' },
          { label: 'Conservative',     tone: 'bg-sky-500/20 text-sky-300' },
          { label: 'Reward-driven',    tone: 'bg-violet-500/20 text-violet-300' },
        ]}
        body="Uses a neural-network policy trained to balance throughput, latency, and loss. Adapts its behaviour to conditions it has seen during training."
      />
      <PersonaCard
        name="CUBIC"
        subtitle="Loss-based TCP"
        emoji="⚡"
        accent="orange"
        tagline="Probes aggressively, reacts to loss."
        traits={[
          { label: 'Rule-based',       tone: 'bg-orange-500/20 text-orange-300' },
          { label: 'Aggressive',       tone: 'bg-red-500/20 text-red-300' },
          { label: 'High utilisation', tone: 'bg-amber-500/20 text-amber-300' },
          { label: 'RTT-fair',         tone: 'bg-yellow-500/20 text-yellow-300' },
        ]}
        body="Grows cWnd as a cubic function of time since the last loss event. Battle-tested, predictable, and the default in Linux for ~two decades."
      />
    </div>
  );
}

function PersonaCard({ name, subtitle, emoji, tagline, traits, body, accent }) {
  const borderAccent =
    accent === 'indigo'
      ? 'border-indigo-500/30 hover:border-indigo-400/60'
      : 'border-orange-500/30 hover:border-orange-400/60';

  const gradient =
    accent === 'indigo'
      ? 'from-indigo-500/10 via-transparent to-transparent'
      : 'from-orange-500/10 via-transparent to-transparent';

  const nameColor = accent === 'indigo' ? 'text-indigo-300' : 'text-orange-300';

  return (
    <div
      className={`relative overflow-hidden bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border ${borderAccent} transition-colors`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{emoji}</span>
              <h3 className={`text-lg font-bold ${nameColor}`}>{name}</h3>
            </div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">
              {subtitle}
            </p>
          </div>
          <span className="text-[10px] text-gray-500 italic max-w-[50%] text-right">
            {tagline}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {traits.map((t) => (
            <span
              key={t.label}
              className={`text-[10px] px-2 py-0.5 rounded-full ${t.tone}`}
            >
              {t.label}
            </span>
          ))}
        </div>

        <p className="text-[12px] text-gray-300 leading-relaxed mt-3">
          {body}
        </p>
      </div>
    </div>
  );
}
