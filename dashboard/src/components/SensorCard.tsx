'use client';
import { ReactNode } from 'react';

interface Props {
  title: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  sub?: string;
  accent?: string; // tailwind text color class
}

export default function SensorCard({ title, value, unit, icon, sub, accent = 'text-cyan-400' }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-1 hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-widest">
        <span className={accent}>{icon}</span>
        {title}
      </div>
      <div className="flex items-end gap-1 mt-1">
        <span className={`text-3xl font-bold ${accent}`}>{value}</span>
        {unit && <span className="text-gray-500 text-sm mb-1">{unit}</span>}
      </div>
      {sub && <div className="text-gray-500 text-xs">{sub}</div>}
    </div>
  );
}
