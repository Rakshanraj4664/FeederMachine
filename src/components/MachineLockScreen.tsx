import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ServerOff, HeartPulse } from 'lucide-react';
import { type AuthState } from '../services/plc';

interface MachineLockScreenProps {
  state: AuthState;
}

export const MachineLockScreen: React.FC<MachineLockScreenProps> = ({ state }) => {
  let title = "Machine Authorization Failed";
  let subtitle = "Unauthorized Device";
  let description = "This machine is locked for security. Please contact the administrator to authorize this device.";
  let Icon = ShieldAlert;

  if (state === 'SERVER_UNAVAILABLE') {
    title = "Authorization Server Offline";
    subtitle = "Connection Failed";
    description = "Could not connect to the Raspberry Pi authorization server. Check network connection and ensure the server is running.";
    Icon = ServerOff;
  } else if (state === 'HEARTBEAT_LOST') {
    title = "Safety Lockout";
    subtitle = "Heartbeat Lost";
    description = "The continuous authorization heartbeat was lost. The machine has automatically entered a safe state.";
    Icon = HeartPulse;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/20 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-lg mx-4"
      >
        <div className="bg-slate-900/80 backdrop-blur-xl border border-red-500/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-1.5 overflow-hidden">
            <motion.div
              className="w-full h-full"
              animate={{ backgroundPositionX: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, #ef4444, #ef4444 10px, transparent 10px, transparent 20px)',
                backgroundSize: '200% 100%'
              }}
            />
          </div>

          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-24 h-24 bg-slate-800 border border-red-500/50 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <Icon className="w-12 h-12 text-red-500" />
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-widest">
            {title}
          </h1>
          <p className="text-red-400 text-sm font-bold uppercase tracking-widest mb-4">
            {subtitle}
          </p>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
            {description}
          </p>

          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-sm font-bold uppercase tracking-wider transition-all"
          >
            Retry Connection
          </button>
        </div>
      </motion.div>
    </div>
  );
};
