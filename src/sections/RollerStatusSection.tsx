import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Power, Gauge, WifiOff, Settings, Minus, Plus, Send, X, RefreshCw } from 'lucide-react'
import { GlowingCard } from '../components/GlowingCard'
import { StatusIndicator } from '../components/StatusIndicator'
import { SectionTitle } from '../components/SectionTitle'
import type { PLCRollerState } from '../services/plc'

const API_BASE = 'http://127.0.0.1:8000'

// ── Types ─────────────────────────────────────────────────────────

// ── Register addresses for each roller speed ──────────────────────
// D2 = Infeed, D3 = Tension, D4 = Guide, D5 = Outfeed
const ROLLER_REGISTERS: Record<string, number> = {
  'RL-1': 2,
  'RL-2': 3,
  'RL-3': 4,
  'RL-4': 5,
}

const offlineRollers: PLCRollerState[] = [
  { id: 'RL-1', name: 'Infeed Roller',  speed: 0, load: 0, status: 'warning' },
  { id: 'RL-2', name: 'Tension Roller', speed: 0, load: 0, status: 'warning' },
  { id: 'RL-3', name: 'Guide Roller',   speed: 0, load: 0, status: 'warning' },
  { id: 'RL-4', name: 'Outfeed Roller', speed: 0, load: 0, status: 'warning' },
]

// ── Roller Drum Visual ───────────────────────────────────────────
const RollerDrum: React.FC<{ speed: number; status: PLCRollerState['status'] }> = ({
  speed,
  status,
}) => {
  const isSpinning = speed > 0
  const rotateDuration = isSpinning ? 60 / speed : 0

  const drumColor =
    status === 'error'
      ? 'from-red-300 via-red-200 to-red-300 border-red-400/40'
      : status === 'warning'
      ? 'from-amber-300 via-amber-200 to-amber-300 border-amber-400/40'
      : 'from-slate-300 via-slate-200 to-slate-300 border-slate-400/40'

  return (
    <div className="relative h-20 bg-slate-100 rounded-xl border border-slate-200/80 flex items-center justify-center overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)]">
      <div className={`relative w-40 h-10 rounded border bg-gradient-to-b ${drumColor} shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden`}>
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

        <div className="absolute inset-0 flex flex-col justify-around pointer-events-none">
          <div className="w-full h-px bg-slate-400/25" />
          <div className="w-full h-px bg-slate-400/25" />
          <div className="w-full h-px bg-slate-400/25" />
        </div>

        {!isSpinning && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-bold text-slate-400/60 uppercase tracking-widest">
              STOPPED
            </span>
          </div>
        )}
      </div>

      <div className={`absolute bottom-1.5 right-2 text-[9px] font-mono font-medium ${
        isSpinning ? 'text-cyan-600' : 'text-slate-400'
      }`}>
        {speed} RPM
      </div>

      {isSpinning && (
        <motion.div
          className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-cyan-400"
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}

// ── Load Bar ────────────────────────────────────────────────────
const LoadBar: React.FC<{ load: number }> = ({ load }) => {
  const color =
    load > 85
      ? 'bg-red-500'
      : load > 65
      ? 'bg-amber-400'
      : 'bg-cyan-500'

  return (
    <div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden mt-1">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, load)}%` }}
        transition={{ type: 'spring', stiffness: 60, damping: 14 }}
      />
    </div>
  )
}

// ── Speed Settings Panel ─────────────────────────────────────────
const SpeedSettings: React.FC<{
  roller: PLCRollerState
  onClose: () => void
  onSpeedUpdated: (id: string, newSpeed: number) => void
}> = ({ roller, onClose, onSpeedUpdated }) => {
  const [newSpeed, setNewSpeed] = useState(roller.speed)
  const [sending, setSending] = useState(false)
  const [result, setResult]   = useState<'success' | 'failed' | null>(null)

  const step = 10
  const minSpeed = 0
  const maxSpeed = 3000

  const increment = () => {
    if (newSpeed + step <= maxSpeed) {
      setNewSpeed(newSpeed + step)
      setResult(null)
    }
  }

  const decrement = () => {
    if (newSpeed - step >= minSpeed) {
      setNewSpeed(newSpeed - step)
      setResult(null)
    }
  }

  const handleSet = async () => {
    const register = ROLLER_REGISTERS[roller.id]
    if (register === undefined) return

    setSending(true)
    setResult(null)

    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: register, value: newSpeed }),
      })

      const json = await res.json()

      if (json.written === true) {
        setResult('success')
        onSpeedUpdated(roller.id, newSpeed)
      } else {
        setResult('failed')
      }
    } catch {
      setResult('failed')
    }

    setSending(false)
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="mt-3 pt-3 border-t border-slate-200/60">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
            Speed Control — D{ROLLER_REGISTERS[roller.id]}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Current vs New */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-slate-400 font-mono">
            Current: <span className="text-slate-600 font-semibold">{roller.speed} RPM</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            New: <span className="text-cyan-600 font-semibold">{newSpeed} RPM</span>
          </div>
        </div>

        {/* +/- Controls */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={decrement}
            disabled={newSpeed <= minSpeed}
            className="flex-shrink-0 p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white text-slate-600 transition-all"
          >
            <Minus className="w-4 h-4" />
          </button>

          <div className="flex-1 relative">
            <input
              type="range"
              min={minSpeed}
              max={maxSpeed}
              step={step}
              value={newSpeed}
              onChange={(e) => {
                setNewSpeed(Number(e.target.value))
                setResult(null)
              }}
              className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-cyan-500"
            />
            <div
              className="absolute top-0 left-0 h-2 rounded-full bg-cyan-500/30 pointer-events-none"
              style={{ width: `${(newSpeed / maxSpeed) * 100}%` }}
            />
          </div>

          <button
            onClick={increment}
            disabled={newSpeed >= maxSpeed}
            className="flex-shrink-0 p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white text-slate-600 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Speed label range */}
        <div className="flex justify-between text-[9px] text-slate-400 font-mono mb-3 px-1">
          <span>{minSpeed}</span>
          <span>{maxSpeed / 2}</span>
          <span>{maxSpeed}</span>
        </div>

        {/* Quick preset chips */}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {[0, 500, 1000, 1450, 2000, 2500].map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setNewSpeed(preset)
                setResult(null)
              }}
              className={`
                px-2 py-1 rounded text-[9px] font-semibold transition-all
                ${newSpeed === preset
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }
              `}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* SET Button */}
        <button
          onClick={handleSet}
          disabled={sending || newSpeed === roller.speed}
          className={`
            w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
            text-[11px] font-bold uppercase tracking-wider transition-all duration-200
            ${sending
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : result === 'success'
              ? 'bg-emerald-500 text-white border border-emerald-600 shadow-[0_2px_8px_rgba(16,185,129,0.3)]'
              : result === 'failed'
              ? 'bg-red-500 text-white border border-red-600 shadow-[0_2px_8px_rgba(239,68,68,0.3)]'
              : newSpeed === roller.speed
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'bg-cyan-500 text-white border border-cyan-600 hover:bg-cyan-600 shadow-[0_2px_8px_rgba(6,182,212,0.3)]'
            }
          `}
        >
          <Send className="w-3.5 h-3.5" />
          {sending
            ? 'Writing...'
            : result === 'success'
            ? `SET ✓ — D${ROLLER_REGISTERS[roller.id]} = ${newSpeed}`
            : result === 'failed'
            ? 'SET ✗ Failed'
            : newSpeed === roller.speed
            ? 'No change'
            : `SET ${newSpeed} RPM → D${ROLLER_REGISTERS[roller.id]}`
          }
        </button>

        {/* Error detail */}
        {result === 'failed' && (
          <div className="mt-2 rounded-lg px-3 py-2 border border-red-200 bg-red-50/70 text-red-700 text-[10px] font-mono">
            Write failed — check PLC connection
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Component ───────────────────────────────────────────────
export const RollerStatusSection: React.FC = () => {
  const [rollers, setRollers]       = useState<PLCRollerState[]>(offlineRollers)
  const [connected, setConnected]   = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loading, setLoading]       = useState(false)
  const [openSettings, setOpenSettings] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<'idle' | 'pending' | 'allowed' | 'denied' | 'error'>('idle')

  // ── Fetch rollers from PLC with timeout ──────────────────────
  const fetchRollers = useCallback(async () => {
    setLoading(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 500)

      const res = await fetch(`${API_BASE}/api/plc/rollers`, { signal: controller.signal })
      clearTimeout(timeoutId)
      const json = await res.json()

      if (json.connected && Array.isArray(json.rollers) && json.rollers.length > 0) {
        setRollers(json.rollers)
        setConnected(true)
        setLastUpdated(new Date())
      } else {
        setRollers(offlineRollers)
        setConnected(false)
      }
    } catch {
      setRollers(offlineRollers)
      setConnected(false)
    }

    setLoading(false)
  }, [])

  // ── Defer fetch to after initial render ──────────────────────
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      if (active) fetchRollers()
    }, 300)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [fetchRollers])

  // ── Device verification (HMAC handshake) ─────────────────────
  const verifyDevice = useCallback(async () => {
    const piHost = window.prompt('Enter Raspberry Pi host (e.g. http://192.168.1.50:5000)')
    if (!piHost) return
    const secret = window.prompt('Enter shared secret for HMAC (leave blank to send without HMAC)') || undefined

    setAuthStatus('pending')
    try {
      const macService = await import('../services/mac')
      const mac = await macService.getPrimaryMac()
      if (!mac) {
        setAuthStatus('error')
        return
      }
      const res = await macService.sendMacToPi(piHost, mac, secret)
      if (res.ok) {
        setAuthStatus('allowed')
      } else if (res.status === 403) {
        setAuthStatus('denied')
      } else {
        setAuthStatus('error')
      }
    } catch (e) {
      console.error('verifyDevice error', e)
      setAuthStatus('error')
    }
  }, [])

  // ── Update local state after successful write ──────────────────
  const handleSpeedUpdated = useCallback((id: string, newSpeed: number) => {
    setRollers((prev) =>
      prev.map((r) => (r.id === id ? { ...r, speed: newSpeed } : r))
    )
  }, [])

  return (
    <section className="w-full mt-4">

      {/* ── Title Row ── */}
      <div className="flex items-center justify-between mb-1">
        <SectionTitle title="Roller Systems" subtitle="Servo & Drive Status" />

        <div className="flex items-center gap-3 self-start mt-1">

          {/* Last updated */}
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 font-mono hidden sm:block">
              Last read: {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchRollers}
            disabled={loading}
            className={`
              inline-flex items-center gap-2 px-4 py-2 rounded-xl
              text-[11px] font-bold uppercase tracking-wider
              border transition-all duration-200
              ${loading
                ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 hover:border-cyan-400 shadow-[0_2px_8px_rgba(6,182,212,0.1)]'
              }
            `}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Reading...' : 'Refresh'}
          </button>

          {/* Verify Device Button */}
          <button
            onClick={verifyDevice}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all duration-200 bg-white/70 text-slate-600 hover:bg-slate-50 hover:border-slate-300`}
          >
            <Send className="w-3.5 h-3.5" />
            Verify Device
          </button>

          {/* Auth status badge */}
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold ${
            authStatus === 'allowed'
              ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200'
              : authStatus === 'pending'
              ? 'bg-amber-100 text-amber-700 border border-amber-200'
              : authStatus === 'denied'
              ? 'bg-red-500/10 text-red-700 border border-red-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}>
            {authStatus === 'allowed' && 'Verified'}
            {authStatus === 'pending' && 'Verifying...'}
            {authStatus === 'denied' && 'Denied'}
            {authStatus === 'error' && 'Error'}
            {authStatus === 'idle' && 'Idle'}
          </div>

          {/* PLC connection badge */}
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold ${
            connected
              ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200'
              : 'bg-red-500/10 text-red-700 border border-red-200'
          }`}>
            {connected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                PLC live
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                PLC offline
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Roller Cards ── */}
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
                  <LoadBar load={roller.load} />
                </div>
              </div>

              {/* Settings Toggle Button */}
              <button
                onClick={() =>
                  setOpenSettings(openSettings === roller.id ? null : roller.id)
                }
                className={`
                  w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  text-[11px] font-bold uppercase tracking-wider
                  border transition-all duration-200
                  ${openSettings === roller.id
                    ? 'border-cyan-400 bg-cyan-50 text-cyan-700 shadow-[0_2px_8px_rgba(6,182,212,0.15)]'
                    : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
                  }
                `}
              >
                <Settings className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openSettings === roller.id ? 'rotate-90' : ''
                }`} />
                {openSettings === roller.id ? 'Close Settings' : 'Speed Settings'}
              </button>

              {/* Speed Settings Panel — slides open/closed */}
              <AnimatePresence>
                {openSettings === roller.id && (
                  <SpeedSettings
                    roller={roller}
                    onClose={() => setOpenSettings(null)}
                    onSpeedUpdated={handleSpeedUpdated}
                  />
                )}
              </AnimatePresence>

            </GlowingCard>
          </motion.div>
        ))}
      </div>
    </section>
  )
}