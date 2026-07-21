'use client';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { SensorLog } from '@/lib/supabase';
import { format } from 'date-fns';

interface Props {
  data: SensorLog[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value?.toFixed(2)}</strong>
        </p>
      ))}
    </div>
  );
};

export default function TimeSeriesChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    time: format(new Date(d.created_at), 'HH:mm:ss'),
  }));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <h3 className="text-sm text-gray-400 uppercase tracking-widest mb-4">VPD & Sensor Timeline</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={formatted} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis yAxisId="vpd" domain={[0, 'auto']} tick={{ fill: '#6b7280', fontSize: 10 }} />
          <YAxis yAxisId="temp" orientation="right" tick={{ fill: '#6b7280', fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />

          {/* VPD threshold lines */}
          <ReferenceLine yAxisId="vpd" y={0.4} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '0.4', fill: '#f59e0b', fontSize: 9 }} />
          <ReferenceLine yAxisId="vpd" y={0.2} stroke="#ef4444" strokeDasharray="4 2" label={{ value: '0.2', fill: '#ef4444', fontSize: 9 }} />

          <Line yAxisId="vpd"  type="monotone" dataKey="vpd"      name="VPD (kPa)"  stroke="#06b6d4" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line yAxisId="temp" type="monotone" dataKey="air_temp" name="Suhu Udara" stroke="#f97316" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line yAxisId="temp" type="monotone" dataKey="air_hum"  name="Kelembapan" stroke="#8b5cf6" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line yAxisId="temp" type="monotone" dataKey="soil"     name="Tanah (cb)" stroke="#22c55e" dot={false} strokeWidth={1.5} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
