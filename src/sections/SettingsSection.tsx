import React, { useState } from 'react';
import { Settings, Sliders, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { GlowingCard } from '../components/GlowingCard';
import { SectionTitle } from '../components/SectionTitle';
import { IndustrialButton } from '../components/IndustrialButton';

export const SettingsSection: React.FC = () => {
  const [speedVal, setSpeedVal] = useState(1450);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="w-full mt-4 mb-8">
      <SectionTitle title="Machine Configuration" subtitle="Speeds & Calibration" />

      <GlowingCard className="p-6 md:p-8" strong>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Speed Control */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-cyan-500" /> 
              Global Speed Limit
            </h3>

            <div className="rounded-2xl border border-slate-200/70 bg-white/60 backdrop-blur-sm p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-600 text-sm font-semibold tracking-wider">Master RPM</span>
                <span className="font-mono text-2xl font-bold text-slate-800 metric-display">{speedVal}</span>
              </div>

              <div className="relative">
                <input 
                  type="range" 
                  min="0" 
                  max="3000" 
                  step="10"
                  value={speedVal}
                  onChange={(e) => setSpeedVal(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
                {/* Track fill */}
                <div 
                  className="absolute top-0 left-0 h-2.5 rounded-full bg-cyan-500/30 pointer-events-none"
                  style={{ width: `${(speedVal / 3000) * 100}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-mono font-medium">
                <span>0</span>
                <span>1500</span>
                <span>3000</span>
              </div>

              {/* Preset chips */}
              <div className="flex gap-2 mt-4">
                {[800, 1200, 1450, 1800, 2200].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setSpeedVal(preset)}
                    className={`
                      px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all
                      ${speedVal === preset 
                        ? 'bg-cyan-500 text-white shadow-[0_2px_8px_rgba(6,182,212,0.25)]' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                      }
                    `}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-cyan-500" /> 
              System Actions
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <IndustrialButton variant="outline" size="md">
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Calibrate Zero
              </IndustrialButton>
              <IndustrialButton variant="outline" size="md">
                <AlertTriangle className="w-4 h-4 mr-1.5" />
                Reset Alarms
              </IndustrialButton>
              <IndustrialButton 
                variant={saved ? 'accent' : 'primary'} 
                size="md" 
                className="col-span-2 mt-1"
                onClick={handleSave}
              >
                <Save className="w-4 h-4 mr-1.5" /> 
                {saved ? 'Saved!' : 'Save Configuration'}
              </IndustrialButton>
            </div>

            {/* Quick Info */}
            <div className="mt-5 rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Last Saved</div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                <span className="text-sm text-slate-600 font-mono">2026-05-19 11:04:30</span>
              </div>
            </div>
          </div>

        </div>
      </GlowingCard>
    </section>
  );
};