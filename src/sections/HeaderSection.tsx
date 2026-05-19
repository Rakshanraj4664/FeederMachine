import React, { useState, useEffect } from 'react';
import { Activity, Wifi, Cpu } from 'lucide-react';
import { GlowingCard } from '../components/GlowingCard';
import { StatusIndicator } from '../components/StatusIndicator';
import { getPlcStatus, type PLCStatus } from '../services/plc';

export const HeaderSection: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [plcStatus, setPlcStatus] = useState<PLCStatus>({
    connected: false,
    host: '192.168.1.5',
    port: 502,
    latency_ms: null,
  });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const status = await getPlcStatus();
      if (active) setPlcStatus(status);
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="w-full mt-2">
      <GlowingCard strong className="px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-5">

        {/* Left: Machine Name & PLC Status */}
        <div className="flex items-center gap-5">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_16px_rgba(6,182,212,0.1)]">
            <Cpu className="text-cyan-600 w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-[0.08em] text-slate-900 uppercase">
              FX-9000 Feeder
            </h1>
            <p className="text-slate-500 text-[11px] tracking-[0.25em] font-semibold mt-0.5 uppercase">
              Main Control Unit
            </p>
          </div>

          <div className="h-10 w-px bg-slate-300/80 hidden md:block" />

          <div className="flex items-center gap-2.5">
            <StatusIndicator status={plcStatus.connected ? 'ok' : 'error'} size="sm" />
            <div className="flex flex-col">
              <span className={`text-[11px] font-bold tracking-[0.2em] uppercase ${plcStatus.connected ? 'text-emerald-500' : 'text-red-500'}`}>
                {plcStatus.connected ? 'PLC Connected' : 'PLC Not Connected'}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                {plcStatus.host}:{plcStatus.port}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Active Status */}
        <div className="flex items-center gap-3 bg-emerald-500/8 px-5 py-2.5 rounded-xl border border-emerald-500/15">
          <Activity className="text-emerald-600 w-4 h-4 animate-pulse" />
          <span className="text-slate-800 text-sm font-semibold tracking-[0.12em] uppercase">System Running</span>
        </div>

        {/* Right: Network & Time */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <Wifi className="text-slate-500 w-4 h-4" />
            <span className="text-slate-600 text-[11px] font-bold tracking-[0.15em] uppercase">Local</span>
          </div>

          <div className="h-8 w-px bg-slate-300/80 hidden md:block" />

          <div className="flex flex-col items-end">
            <span className="text-xl font-mono font-bold text-slate-800 tracking-tight metric-display">
              {time.toLocaleTimeString('en-US', { hour12: false })}
            </span>
            <span className="text-[11px] tracking-[0.15em] text-slate-500 font-mono font-medium mt-0.5">
              {time.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')}
            </span>
          </div>
        </div>

      </GlowingCard>
    </header>
  );
};