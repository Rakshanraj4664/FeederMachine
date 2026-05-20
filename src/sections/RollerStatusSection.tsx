import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, Gauge, WifiOff } from 'lucide-react';
import { GlowingCard } from '../components/GlowingCard';
import { StatusIndicator } from '../components/StatusIndicator';
import { SectionTitle } from '../components/SectionTitle';
import { getPlcRollers, type PLCRollerState } from '../services/plc';

const offlineRollers: PLCRollerState[] = [
  { id: 'RL-1', name: 'Infeed Roller',  speed: 0, load: 0, status: 'warning' },
  { id: 'RL-2', name: 'Tension Roller', speed: 0, load: 0, status: 'warning' },
  { id: 'RL-3', name: 'Guide Roller',   speed: 0, load: 0, status: 'warning' },
  { id: 'RL-4', name: 'Outfeed Roller', speed: 0, load: 0, status: 'warning' },
];

// ── Roller Drum Visual ───────────────────────────────────────────
// Isolated so framer-motion re-evaluates transition only when speed changes
const RollerDrum: React.FC<{ speed: number; status: PLCRollerState['status'] }> = ({
  speed,
  status,
}) => {
  const isSpinning = speed > 0;

  // RPM → seconds per full rotation
  // e.g. 60 RPM = 1 rotation/sec | 120 RPM = 0.5 sec
  const rotateDuration = isSpinning ? 60 / speed : 0;

  const drumColor =
    status === 'error'
      ? 'from-red-300 via-red-200 to-red-300 border-red-400/40'
      : status === 'warning'
      ? 'from-amber-300 via-amber-200 to-amber-300 border-amber-400/40'
      : 'from-slate-300 via-slate-200 to-slate-300 border-slate-400/40';

  return (
    <div className="relative h-20 bg-slate-100 rounded-xl border border-slate-200/80 flex items-center justify-center overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)]">
      
      {/* Drum body */}
      <div className={`relative w-40 h-10 rounded border bg-gradient-to-b ${drumColor} shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden`}>
        
        {/* Spinning stripe overlay */}
        <AnimatePresence>
          {isSpinning && (
            <motion.div
              key="stripes"
              className="absolute inset-0"
              initial={{ backgroundPositionX: '0%' }}
              animate={{ backgroundPositionX: '100%' }}
              transition={{
                duration: rotateDuration,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, transparent, transparent 12px, rgba(0,0,0,0.08) 12px, rgba(0,0,0,0.08) 14px)',
                backgroundSize: '200% 100%',
              }}
            />
          )}
        </AnimatePresence>

        {/* Static lines (always visible) */}
        <div className="absolute inset-0 flex flex-col justify-around pointer-events-none">
          <div className="w-full h-px bg-slate-400/25" />
          <div className="w-full h-px bg-slate-400/25" />
          <div className="w-full h-px bg-slate-400/25" />
        </div>

        {/* Stopped overlay */}
        {!isSpinning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-bold text-slate-400/60 uppercase tracking-widest">
              STOPPED
            </span>
          </div>
        )}
      </div>

      {/* Speed badge */}
      <div className={`absolute bottom-1.5 right-2 text-[9px] font-mono font-medium ${
        isSpinning ? 'text-cyan-600' : 'text-slate-400'
      }`}>
        {speed} RPM
      </div>

      {/* Spinning indicator dot */}
      {isSpinning && (
        <motion.div
          className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-cyan-400"
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
};

// ── Load Bar ────────────────────────────────────────────────────
const LoadBar: React.FC<{ load: number }> = ({ load }) => {
  const color =
    load > 85
      ? 'bg-red-500'
      : load > 65
      ? 'bg-amber-400'
      : 'bg-cyan-500';

  return (
    <div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden mt-1">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, load)}%` }}
        transition={{ type: 'spring', stiffness: 60, damping: 14 }}
      />
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────
export const RollerStatusSection: React.FC = () => {
  const [rollers, setRollers] = useState<PLCRollerState[]>(offlineRollers);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const data = await getPlcRollers();
        if (!active) return;

        if (data.length) {
          setRollers(data);
          setConnected(true);
          setLastUpdated(new Date());
        } else {
          // Empty array returned — PLC offline or no rollers configured
          setRollers(offlineRollers);
          setConnected(false);
        }
      } catch {
        if (!active) return;
        setRollers(offlineRollers);
        setConnected(false);
      }
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
      <div className="flex items-center justify-between mb-1">
        <SectionTitle title="Roller Systems" subtitle="Servo & Drive Status" />

        {/* PLC connection badge */}
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold self-start mt-1 ${
          connected
            ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200'
            : 'bg-red-500/10 text-red-700 border border-red-200'
        }`}>
          {connected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              PLC live · {lastUpdated?.toLocaleTimeString()}
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              PLC offline
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {rollers.map((roller, index) => (
          <motion.div
            key={roller.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4, ease: 'easeOut' }}
          >
            <GlowingCard
              className="p-5 flex flex-col gap-4"
              active={roller.status === 'error'}
              pulse={roller.status === 'error'}
            >
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-cyan-700 font-mono font-bold text-sm tracking-wider">
                      {roller.id}
                    </h3>
                    {roller.status !== 'ok' && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        roller.status === 'error'
                          ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      }`}>
                        {roller.status === 'error' ? 'Error' : 'Warn'}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px] uppercase tracking-[0.15em] font-medium mt-1">
                    {roller.name}
                  </p>
                </div>
                <StatusIndicator status={roller.status} size="md" />
              </div>

              {/* Roller Animation */}
              <RollerDrum speed={roller.speed} status={roller.status} />

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/70 rounded-lg p-2.5 border border-slate-200/60 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] text-slate-400 font-bold tracking-[0.15em] uppercase mb-1 flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> Speed
                  </span>
                  <div className="font-mono text-sm font-bold text-slate-700 metric-display">
                    {roller.speed}
                    <span className="text-[9px] text-slate-400 ml-1 font-medium">RPM</span>
                  </div>
                </div>

                <div className="bg-white/70 rounded-lg p-2.5 border border-slate-200/60 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
                  <span className="text-[10px] text-slate-400 font-bold tracking-[0.15em] uppercase mb-1 flex items-center gap-1">
                    <Power className="w-3 h-3" /> Load
                  </span>
                  <div className="font-mono text-sm font-bold text-slate-700 metric-display">
                    {roller.load}
                    <span className="text-[9px] text-slate-400 ml-1 font-medium">%</span>
                  </div>
                  {/* Visual load bar */}
                  <LoadBar load={roller.load} />
                </div>
              </div>

            </GlowingCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
};