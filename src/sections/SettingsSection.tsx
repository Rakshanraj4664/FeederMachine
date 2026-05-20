import React, { useState } from 'react'
import { Settings, Sliders, RotateCcw, Send } from 'lucide-react'
import { GlowingCard } from '../components/GlowingCard'
import { SectionTitle } from '../components/SectionTitle'
import { IndustrialButton } from '../components/IndustrialButton'

// ── Roller Speed Registers ────────────────────────────────────────
// D2 = Infeed Roller
// D3 = Tension Roller
// D4 = Guide Roller
// D5 = Outfeed Roller
const ROLLER_SPEED_REGISTERS = [2, 3, 4, 5]

export const SettingsSection: React.FC = () => {
  const [speedVal,  setSpeedVal]  = useState(1450)
  const [sending,   setSending]   = useState(false)
  const [lastSet,   setLastSet]   = useState<string | null>(null)
  const [setResult, setSetResult] = useState<'success' | 'failed' | null>(null)

  // ── Write speed to all 4 roller registers ────────────────────
  const handleSet = async () => {
    setSending(true)
    setSetResult(null)

    try {
      // Write to D2, D3, D4, D5 all at once
      const writes = ROLLER_SPEED_REGISTERS.map((address) =>
        fetch('http://127.0.0.1:8000/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, value: speedVal }),
        }).then((res) => res.json())
      )

      const results = await Promise.all(writes)

      // Check all 4 writes succeeded
      const allWritten = results.every((r) => r.written === true)

      if (allWritten) {
        setSetResult('success')
        setLastSet(new Date().toLocaleString())
      } else {
        setSetResult('failed')
      }
    } catch {
      setSetResult('failed')
    }

    setSending(false)
  }

  // ── Reset speed slider to 0 ───────────────────────────────────
  const handleResetSpeed = () => {
    setSpeedVal(0)
    setSetResult(null)
  }

  return (
    <section className="w-full mt-4 mb-8">
      <SectionTitle title="Machine Configuration" subtitle="Speeds & Calibration" />

      <GlowingCard className="p-6 md:p-8" strong>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Speed Control ───────────────────────────────────── */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-cyan-500" />
              Global Speed Limit
            </h3>

            <div className="rounded-2xl border border-slate-200/70 bg-white/60 backdrop-blur-sm p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">

              {/* Current value */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-600 text-sm font-semibold tracking-wider">
                  Master RPM
                </span>
                <span className="font-mono text-2xl font-bold text-slate-800 metric-display">
                  {speedVal}
                </span>
              </div>

              {/* Slider */}
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="10"
                  value={speedVal}
                  onChange={(e) => {
                    setSpeedVal(Number(e.target.value))
                    setSetResult(null)
                  }}
                  className="w-full h-2.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
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
              <div className="flex gap-2 mt-4 flex-wrap">
                {[800, 1200, 1450, 1800, 2200].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setSpeedVal(preset)
                      setSetResult(null)
                    }}
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

              {/* Which rollers will be updated */}
              <div className="mt-4 pt-4 border-t border-slate-200/60">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
                  Will write to
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { reg: 'D2', name: 'Infeed'   },
                    { reg: 'D3', name: 'Tension'  },
                    { reg: 'D4', name: 'Guide'    },
                    { reg: 'D5', name: 'Outfeed'  },
                  ].map((r) => (
                    <div
                      key={r.reg}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/80 text-[10px] font-mono text-slate-600"
                    >
                      {r.reg} — {r.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Actions ─────────────────────────────────────────── */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-cyan-500" />
              System Actions
            </h3>

            <div className="grid grid-cols-1 gap-3">

              {/* Reset Speed */}
              <IndustrialButton
                variant="outline"
                size="md"
                onClick={handleResetSpeed}
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Reset Speed
              </IndustrialButton>

              {/* SET — writes to D2 D3 D4 D5 */}
              <IndustrialButton
                variant={
                  setResult === 'success'
                    ? 'accent'
                    : setResult === 'failed'
                    ? 'outline'
                    : 'primary'
                }
                size="md"
                onClick={handleSet}
                disabled={sending}
              >
                <Send className="w-4 h-4 mr-1.5" />
                {sending
                  ? 'Writing to PLC...'
                  : setResult === 'success'
                  ? 'SET ✓'
                  : setResult === 'failed'
                  ? 'SET ✗ Failed'
                  : 'SET'}
              </IndustrialButton>

              {/* Result feedback */}
              {setResult === 'failed' && (
                <div className="rounded-xl px-4 py-2.5 border border-red-200 bg-red-50/70 text-red-700 text-[11px] font-mono">
                  Write failed — check PLC connection
                </div>
              )}

              {setResult === 'success' && (
                <div className="rounded-xl px-4 py-2.5 border border-emerald-200 bg-emerald-50/70 text-emerald-700 text-[11px] font-mono">
                  {speedVal} RPM written to D2, D3, D4, D5
                </div>
              )}
            </div>

            {/* Last SET info */}
            <div className="mt-5 rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                Last SET
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  lastSet
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                    : 'bg-slate-300'
                }`} />
                <span className="text-sm text-slate-600 font-mono">
                  {lastSet ?? 'No value set yet'}
                </span>
              </div>

              {lastSet && (
                <div className="mt-2 text-[10px] text-slate-400 font-mono">
                  D2, D3, D4, D5 = {speedVal} RPM
                </div>
              )}
            </div>
          </div>

        </div>
      </GlowingCard>
    </section>
  )
}