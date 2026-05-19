import React, { useEffect, useState } from 'react';
import { Database, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GlowingCard } from '../components/GlowingCard';
import { SectionTitle } from '../components/SectionTitle';
import { getPlcDiagnostics, getPlcSensors, type PLCSensorReading } from '../services/plc';

const offlineSensors: PLCSensorReading[] = [
  { label: 'Fabric Tension', value: '--', unit: 'N', trend: 'stable' },
  { label: 'Edge Alignment', value: '--', unit: 'mm', trend: 'stable' },
  { label: 'Roller Current', value: '--', unit: 'A', trend: 'stable' },
  { label: 'Ambient Temp', value: '--', unit: '°C', trend: 'stable' },
];

const TrendIcon = ({ trend }: { trend: 'stable' | 'rising' | 'falling' }) => {
  if (trend === 'rising') return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (trend === 'falling') return <TrendingDown className="w-3 h-3 text-amber-500" />;
  return <Minus className="w-3 h-3 text-slate-400" />;
};

export const DiagnosticsSection: React.FC = () => {
  const [sensors, setSensors] = useState<PLCSensorReading[]>(offlineSensors);
  const [diagnostics, setDiagnostics] = useState<Array<{ title: string; value: string; detail: string; variant: 'ok' | 'warning' | 'error' }>>([]);
  const [plcConnected, setPlcConnected] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const sensorData = await getPlcSensors();
      const diagData = await getPlcDiagnostics();
      if (!active) return;
      setPlcConnected(sensorData.length > 0 || diagData.length > 0);
      setSensors(sensorData.length ? sensorData : offlineSensors);
      setDiagnostics(diagData);
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const displayedDiagnostics = diagnostics.length
    ? diagnostics
    : [
        { title: 'PLC Status', value: plcConnected ? 'Online' : 'Offline', detail: plcConnected ? 'Communication is good' : 'Connection lost', variant: plcConnected ? 'ok' : 'error' },
        { title: 'Network Link', value: plcConnected ? 'Active' : 'Down', detail: 'Check PLC cable or IP', variant: plcConnected ? 'ok' : 'warning' },
        { title: 'Control Health', value: plcConnected ? 'OK' : 'No data', detail: 'Awaiting PLC response', variant: plcConnected ? 'ok' : 'warning' },
      ];

  return (
    <section className="w-full mt-4">
      <SectionTitle title="System Diagnostics" subtitle="Sensors & Health" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Sensor Values */}
        <GlowingCard className="col-span-1 lg:col-span-2 p-6" strong>
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
            Live Sensor Feed
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sensors.map((item, index) => (
              <div 
                key={index} 
                className="rounded-2xl p-4 border border-slate-200/70 bg-white/60 backdrop-blur-sm flex items-center gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-shadow"
              >
                <div className={`
                  p-3 rounded-xl flex-shrink-0
                  ${item.trend === 'rising' 
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/15' 
                    : item.trend === 'falling'
                    ? 'bg-amber-500/8 text-amber-600 border border-amber-500/15'
                    : 'bg-cyan-500/8 text-cyan-600 border border-cyan-500/15'
                  }
                `}>
                  <Database className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em]">{item.label}</div>
                    <TrendIcon trend={item.trend} />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xl font-bold text-slate-800 metric-display">{item.value}</span>
                    <span className="text-[11px] text-slate-400 font-medium">{item.unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mini chart placeholder */}
          <div className="mt-5 pt-5 border-t border-slate-200/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Voltage History</span>
              <span className="text-[10px] text-slate-400 font-mono">Last 60s</span>
            </div>
            <div className="h-16 flex items-end gap-1">
              {[65, 72, 68, 75, 80, 78, 82, 85, 83, 88, 90, 87, 92, 95, 93, 96, 94, 98, 100, 97].map((h, i) => (
                <div 
                  key={i} 
                  className="flex-1 rounded-t bg-cyan-500/20 hover:bg-cyan-500/40 transition-colors"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </GlowingCard>

        {/* Diagnostics Overview Panel */}
        <GlowingCard className="col-span-1 p-6" active>
          <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            System Diagnostics
          </h3>

          <div className="flex flex-col gap-3">
            {displayedDiagnostics.map((item, index) => (
              <div
                key={index}
                className={`rounded-xl px-4 py-3 border ${item.variant === 'ok' ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700' : item.variant === 'warning' ? 'border-amber-200 bg-amber-50/70 text-amber-700' : 'border-red-200 bg-red-50/70 text-red-700'} text-xs uppercase tracking-[0.1em] font-mono font-medium`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{item.title}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-slate-200/60">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">System Health</div>
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={plcConnected ? '#10b981' : '#fb7185'}
                    strokeWidth="3"
                    strokeDasharray={plcConnected ? '92, 100' : '52, 100'}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-700 font-mono">
                  {plcConnected ? 'OK' : 'OFF'}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-700">{plcConnected ? 'PLC online' : 'PLC offline'}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{plcConnected ? 'Live sensor and roller data streaming' : 'Waiting for PLC connection'}</div>
              </div>
            </div>
          </div>
        </GlowingCard>

      </div>
    </section>
  );
};