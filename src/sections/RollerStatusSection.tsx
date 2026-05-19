import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Power, Gauge } from 'lucide-react';
import { GlowingCard } from '../components/GlowingCard';
import { StatusIndicator } from '../components/StatusIndicator';
import { SectionTitle } from '../components/SectionTitle';
import { getPlcRollers, type PLCRollerState } from '../services/plc';

const offlineRollers: PLCRollerState[] = [
  { id: 'RL-101', name: 'Infeed Roller', speed: 0, load: 0, status: 'warning' },
  { id: 'RL-102', name: 'Tension Roller', speed: 0, load: 0, status: 'warning' },
  { id: 'RL-103', name: 'Guide Roller', speed: 0, load: 0, status: 'warning' },
  { id: 'RL-104', name: 'Outfeed Roller', speed: 0, load: 0, status: 'warning' },
];

export const RollerStatusSection: React.FC = () => {
  const [rollers, setRollers] = useState<PLCRollerState[]>(offlineRollers);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const data = await getPlcRollers();
      if (!active) return;
      setRollers(data.length ? data : offlineRollers);
    };

    refresh();
    const interval = setInterval(refresh, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="w-full mt-4">
      <SectionTitle title="Roller Systems" subtitle="Servo & Drive Status" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {rollers.map((roller, index) => (
          <motion.div
            key={roller.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4, ease: 'easeOut' }}
          >
            <GlowingCard className="p-5 flex flex-col gap-4" active={roller.status !== 'ok'}>

              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-cyan-700 font-mono font-bold text-sm tracking-wider">{roller.id}</h3>
                    {roller.status !== 'ok' && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${roller.status === 'error' ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                        {roller.status === 'error' ? 'Error' : 'Warn'}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px] uppercase tracking-[0.15em] font-medium mt-1">{roller.name}</p>
                </div>
                <StatusIndicator status={roller.status} size="md" />
              </div>

              {/* Roller Animation */}
              <div className="relative h-20 bg-slate-100 rounded-xl border border-slate-200/80 flex items-center justify-center overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)]">
                <motion.div 
                  className="w-40 h-10 rounded border border-slate-400/40 bg-gradient-to-b from-slate-300 via-slate-200 to-slate-300 flex flex-col justify-between overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                  animate={{ rotateX: [0, 360] }}
                  transition={{ 
                    duration: roller.speed > 0 ? (2000 / roller.speed) : 0, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }}
                >
                  <div className="w-full h-px bg-slate-400/30" />
                  <div className="w-full h-px bg-slate-400/30" />
                  <div className="w-full h-px bg-slate-400/30" />
                </motion.div>

                {/* Speed overlay */}
                <div className="absolute bottom-1.5 right-2 text-[9px] font-mono text-slate-400 font-medium">
                  {roller.speed} RPM
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/70 rounded-lg p-2.5 border border-slate-200/60 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] text-slate-400 font-bold tracking-[0.15em] uppercase mb-1 flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> Speed
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-700 metric-display">
                    {roller.speed}
                    <span className="text-[9px] text-slate-400 ml-1 font-medium">RPM</span>
                  </span>
                </div>
                <div className="bg-white/70 rounded-lg p-2.5 border border-slate-200/60 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] text-slate-400 font-bold tracking-[0.15em] uppercase mb-1 flex items-center gap-1">
                    <Power className="w-3 h-3" /> Load
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-700 metric-display">
                    {roller.load}
                    <span className="text-[9px] text-slate-400 ml-1 font-medium">%</span>
                  </span>
                </div>
              </div>

            </GlowingCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
};