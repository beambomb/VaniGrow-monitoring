'use client';

type Risk = 'LOW' | 'MEDIUM' | 'HIGH';

const config: Record<Risk, { label: string; bg: string; text: string; ring: string; pulse: boolean }> = {
  LOW:    { label: 'LOW',    bg: 'bg-emerald-500/20', text: 'text-emerald-400', ring: 'ring-emerald-500', pulse: false },
  MEDIUM: { label: 'MEDIUM', bg: 'bg-amber-500/20',   text: 'text-amber-400',   ring: 'ring-amber-500',   pulse: true  },
  HIGH:   { label: 'HIGH',   bg: 'bg-red-500/20',     text: 'text-red-400',     ring: 'ring-red-500',     pulse: true  },
};

export default function RiskBadge({ level }: { level: Risk }) {
  const c = config[level] ?? config.LOW;
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${c.bg} ring-1 ${c.ring}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${c.text.replace('text-', 'bg-')} ${c.pulse ? 'animate-pulse' : ''}`} />
      <span className={`font-bold text-sm tracking-widest ${c.text}`}>{c.label}</span>
    </div>
  );
}
