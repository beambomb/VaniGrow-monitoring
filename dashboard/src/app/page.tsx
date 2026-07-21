'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase, SensorLog, DeviceStatus } from '@/lib/supabase';
import TimeSeriesChart from '@/components/TimeSeriesChart';
import DeviceControl from '@/components/DeviceControl';
import ThemeToggle from '@/components/ThemeToggle';
import ReportModal from '@/components/ReportModal';
import { formatDistanceToNow } from 'date-fns';
import { FileText } from 'lucide-react';

const DEVICE_ID = 'gh01';
const HISTORY_LIMIT = 120;

type Risk = 'LOW' | 'MEDIUM' | 'HIGH';

const RISK_META: Record<Risk, { label: string; color: string; bg: string; desc: string }> = {
  LOW:    { label: 'LOW RISK',    color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   desc: 'Kondisi aman, akumulasi jamur rendah' },
  MEDIUM: { label: 'MEDIUM RISK', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  desc: 'Waspada — fan aktif, ventilasi 45°' },
  HIGH:   { label: 'HIGH RISK',   color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   desc: 'Bahaya — semua sistem pendingin aktif' },
};

function MetricRow({ label, value, unit, note, alert }: { label: string; value: string; unit: string; note?: string; alert?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-gray-200 dark:border-[#1e2332] last:border-0 ${alert ? 'text-amber-500 dark:text-amber-400' : ''}`}>
      <div>
        <span className="text-[13px] text-gray-500 dark:text-[#8b95b0]">{label}</span>
        {note && <span className="ml-2 text-[11px] text-gray-400 dark:text-[#4b5470]">{note}</span>}
      </div>
      <div className="text-right">
        <span className={`text-[15px] font-mono font-semibold ${alert ? 'text-amber-500 dark:text-amber-400' : 'text-gray-900 dark:text-[#e2e8f0]'}`}>{value}</span>
        <span className="ml-1 text-[11px] text-gray-400 dark:text-[#4b5470]">{unit}</span>
      </div>
    </div>
  );
}

function Panel({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2332] rounded-lg p-4 shadow-sm dark:shadow-none ${className}`}>
      {title && <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-[#4b5470] mb-3">{title}</p>}
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [latest, setLatest]   = useState<SensorLog | null>(null);
  const [history, setHistory] = useState<SensorLog[]>([]);
  const [status, setStatus]   = useState<DeviceStatus | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const loadInitial = useCallback(async () => {
    const { data: logs } = await supabase
      .from('sensor_logs').select('*')
      .eq('device_id', DEVICE_ID)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    if (logs?.length) {
      setLatest(logs[0] as SensorLog);
      setHistory((logs as SensorLog[]).reverse());
    }
    const { data: dev } = await supabase
      .from('device_status').select('*')
      .eq('device_id', DEVICE_ID).single();
    if (dev) setStatus(dev as DeviceStatus);
  }, []);

  useEffect(() => {
    loadInitial();
    const poll = setInterval(async () => {
      const { data: logs } = await supabase
        .from('sensor_logs').select('*')
        .eq('device_id', DEVICE_ID)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);
      if (logs?.length) {
        setLatest(logs[0] as SensorLog);
        setHistory((logs as SensorLog[]).reverse());
      }
      const { data: dev } = await supabase
        .from('device_status').select('*')
        .eq('device_id', DEVICE_ID).single();
      if (dev) setStatus(dev as DeviceStatus);
    }, 1000);
    return () => clearInterval(poll);
  }, [loadInitial]);

  const risk = (latest?.risk_level ?? 'LOW') as Risk;
  const rm   = RISK_META[risk];
  const isOnline = status?.status === 'online';
  const vpdClass = !latest ? '' : latest.vpd < 0.2 ? 'text-red-500 dark:text-red-400' : latest.vpd < 0.4 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080b10] text-gray-900 dark:text-[#e2e8f0] font-mono transition-colors">
      
      {/* Modals */}
      <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />

      {/* Top bar */}
      <div className="border-b border-gray-200 dark:border-[#1e2332] bg-white dark:bg-[#0d1117] px-6 py-3 flex items-center justify-between shadow-sm dark:shadow-none transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-bold text-gray-900 dark:text-white">VaniGrow Monitor</span>
          <span className="hidden sm:inline text-[11px] text-gray-500 dark:text-[#4b5470] bg-gray-100 dark:bg-[#1e2332] px-2 py-0.5 rounded-full">device: {DEVICE_ID}</span>
        </div>
        <div className="flex items-center gap-4 text-[12px]">
          <span className={`hidden sm:flex items-center gap-1.5 ${isOnline ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-[#4b5470]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-gray-400 dark:bg-[#4b5470]'}`} />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
          {status && (
            <span className="hidden md:inline text-gray-500 dark:text-[#4b5470]">
              updated {formatDistanceToNow(new Date(status.updated_at), { addSuffix: true })}
            </span>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-2 border-l border-gray-200 dark:border-[#1e2332] pl-4">
            <button 
              onClick={() => setIsReportOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-semibold"
            >
              <FileText size={16} /> <span className="hidden sm:inline">Export Report</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* ── RISK HERO ─────────────────────────────────────────── */}
        <div className="rounded-lg overflow-hidden border bg-white dark:bg-transparent shadow-sm dark:shadow-none transition-colors" style={{ borderColor: rm.color + '30' }}>
          {/* Color bar */}
          <div className="h-1.5 w-full" style={{ backgroundColor: rm.color }} />

          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ backgroundColor: rm.bg }}>
            {/* Big status */}
            <div className="flex-1">
              <p className="text-[11px] text-gray-600 dark:text-[#4b5470] uppercase tracking-widest mb-1">Fungal Risk Status</p>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-black tracking-tight" style={{ color: rm.color }}>
                  {risk}
                </span>
                <span className="text-[13px] text-gray-600 dark:text-[#8b95b0] max-w-xs">{rm.desc}</span>
              </div>
            </div>

            {/* OVERRIDE ACTUATOR KARENA WOKWI LAMA (HOTFIX) */}
            {(() => {
              if (latest) {
                if (latest.risk_level === 'HIGH') {
                  latest.fan = true;
                  latest.vent = 90;
                } else if (latest.risk_level === 'MEDIUM') {
                  latest.fan = true;
                  latest.vent = 45;
                } else if (latest.risk_level === 'LOW' && latest.auto_mode !== false) {
                  latest.fan = false;
                  latest.vent = 0;
                }
              }
              return null;
            })()}

            {/* Key numbers */}
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-[10px] text-gray-500 dark:text-[#4b5470] uppercase tracking-widest">VPD</p>
                <p className={`text-2xl font-mono font-bold ${vpdClass}`}>
                  {latest?.vpd !== undefined ? Math.max(0, latest.vpd).toFixed(2) : '—'}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-[#4b5470]">kPa</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-[#4b5470] uppercase tracking-widest">Acc. Duration</p>
                <p className="text-2xl font-mono font-bold text-gray-900 dark:text-[#e2e8f0]">
                  {latest?.low_vpd_dur?.toFixed(1) ?? '—'}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-[#4b5470]">menit · threshold 5/15</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-[#4b5470] uppercase tracking-widest">Fan</p>
                <p className={`text-2xl font-mono font-bold ${latest?.fan ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-[#4b5470]'}`}>
                  {latest ? (latest.fan ? 'ON' : 'OFF') : '—'}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-[#4b5470]">vent {latest?.vent ?? '—'}°</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left: sensor data */}
          <div className="space-y-4">
            <Panel title="Atmospheric">
              <MetricRow
                label="Air Temperature"
                value={latest?.air_temp?.toFixed(1) ?? '—'}
                unit="°C"
              />
              <MetricRow
                label="Relative Humidity"
                value={latest?.air_hum?.toFixed(1) ?? '—'}
                unit="% RH"
                alert={latest ? latest.air_hum > 85 : false}
              />
              <MetricRow
                label="Leaf Surface Temp"
                value={latest?.leaf_temp?.toFixed(1) ?? '—'}
                unit="°C"
              />
            </Panel>

            <Panel title="VPD (Vapor Pressure Deficit)">
              <p className={`text-3xl font-bold ${vpdClass}`}>
                {latest?.vpd !== undefined ? Math.max(0, latest.vpd).toFixed(3) : '—'}
                <span className="text-[14px] text-gray-500 dark:text-[#4b5470] ml-1.5 font-normal">kPa</span>
              </p>
              <div className="mt-3 space-y-1.5">
                {[
                  { range: '< 0.2', label: 'Critical', cls: 'text-red-500 dark:text-red-400',     active: !!latest && latest.vpd < 0.2 },
                  { range: '0.2 – 0.4', label: 'Warning', cls: 'text-amber-500 dark:text-amber-400', active: !!latest && latest.vpd >= 0.2 && latest.vpd < 0.4 },
                  { range: '≥ 0.4', label: 'Healthy',  cls: 'text-emerald-500 dark:text-emerald-400', active: !!latest && latest.vpd >= 0.4 },
                ].map(z => (
                  <div key={z.label} className={`flex items-center justify-between text-[12px] ${ z.active ? z.cls : 'text-gray-400 dark:text-[#2a3045]'}`}>
                    <span>{z.label}</span>
                    <span className="font-mono">{z.range} kPa</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Growing Medium &amp; Light">
              <MetricRow
                label="Soil Matric Potential"
                value={latest?.soil?.toString() ?? '—'}
                unit="cb"
                alert={latest ? latest.soil < 10 : false}
              />
              <MetricRow
                label="Illuminance"
                value={latest?.light !== undefined ? (
                  latest.light > 1500 ? (
                    (() => {
                      let r = (1000000000.0 / latest.light) - 10000.0;
                      if (r <= 0) r = 1;
                      let trueLux = Math.pow(250590.0 / r, 1.428);
                      return isNaN(trueLux) ? '0' : Math.round(trueLux).toLocaleString();
                    })()
                  ) : latest.light.toLocaleString()
                ) : '—'}
                unit="Lux"
              />
            </Panel>
          </div>

          {/* Center: chart */}
          <div className="lg:col-span-2 space-y-4">
            <TimeSeriesChart data={history} />

            {/* Actuator status + control */}
            <div className="grid grid-cols-2 gap-4">
              <Panel title="Actuator Status">
                <MetricRow
                  label="Fan / Dehumidifier"
                  value={latest ? (latest.fan ? 'ON' : 'OFF') : '—'}
                  unit=""
                />
                <MetricRow
                  label="Vent Flap"
                  value={latest?.vent?.toString() ?? '—'}
                  unit="°"
                />
                <MetricRow
                  label="Control Mode"
                  value={latest ? (latest.auto_mode ? 'AUTO' : 'MANUAL') : '—'}
                  unit=""
                />
              </Panel>

              <DeviceControl
                deviceId={DEVICE_ID}
                initialAuto={latest?.auto_mode ?? true}
                initialVent={latest?.vent ?? 0}
                initialFan={latest?.fan ?? false}
              />
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}
