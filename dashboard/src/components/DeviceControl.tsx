'use client';
import { useState } from 'react';

interface Props {
  deviceId?: string;
  initialAuto?: boolean;
  initialVent?: number;
  initialFan?: boolean;
}

export default function DeviceControl({ deviceId = 'gh01', initialAuto = true, initialVent = 0, initialFan = false }: Props) {
  const [autoMode, setAutoMode] = useState(initialAuto);
  const [fan, setFan]           = useState(initialFan);
  const [vent, setVent]         = useState(initialVent);
  const [sending, setSending]   = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const sendCmd = async (cmd: object) => {
    setSending(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/cmd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, ...cmd }),
      });
      const json = await res.json();
      setLastResult(json.ok ? 'OK' : `ERR: ${json.error}`);
    } catch (e: any) {
      setLastResult(`ERR: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const toggleAuto = () => { 
    const n = !autoMode; 
    setAutoMode(n); 
    sendCmd({ auto: n, fan, vent }); 
  };
  const toggleFan = () => { 
    const n = !fan; 
    setFan(n); 
    sendCmd({ auto: autoMode, fan: n, vent }); 
  };
  const handleVentChange = (v: number) => {
    setVent(v);
    sendCmd({ auto: autoMode, fan, vent: v });
  };

  return (
    <div className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#1e2332] rounded-lg p-4 shadow-sm dark:shadow-none transition-colors">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-[#4b5470] mb-3">Remote Control</p>

      <div className="space-y-3">
        {/* Mode */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-gray-600 dark:text-[#8b95b0]">Mode</span>
          <button
            onClick={toggleAuto} disabled={sending}
            className={`text-[11px] px-3 py-1 rounded border font-mono transition-colors ${
              autoMode
                ? 'border-emerald-500 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-amber-500 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
            }`}
          >
            {autoMode ? 'AUTO' : 'MANUAL'}
          </button>
        </div>

        {/* Fan */}
        <div className={`flex items-center justify-between ${autoMode ? 'opacity-30 pointer-events-none' : ''}`}>
          <span className="text-[13px] text-gray-600 dark:text-[#8b95b0]">Fan / Dehumidifier</span>
          <button
            onClick={toggleFan} disabled={sending || autoMode}
            className={`text-[11px] px-3 py-1 rounded border font-mono transition-colors ${
              fan
                ? 'border-blue-500 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-[#1e2332] text-gray-400 dark:text-[#4b5470]'
            }`}
          >
            {fan ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Vent slider */}
        <div className={autoMode ? 'opacity-30 pointer-events-none' : ''}>
          <div className="flex justify-between text-[12px] text-gray-600 dark:text-[#8b95b0] mb-1.5">
            <span>Vent Flap</span>
            <span className="font-mono text-gray-900 dark:text-[#e2e8f0]">{vent}°</span>
          </div>
          <input
            type="range" min={0} max={90} step={5}
            value={vent} disabled={sending || autoMode}
            onChange={(e) => handleVentChange(Number(e.target.value))}
            className="w-full h-1 accent-gray-500 dark:accent-[#4b5470] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400 dark:text-[#2a3045] mt-0.5">
            <span>0° Closed</span><span>90° Open</span>
          </div>
        </div>

        {lastResult && (
          <p className={`text-[11px] font-mono ${lastResult === 'OK' ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            → {lastResult}
          </p>
        )}
      </div>
    </div>
  );
}
