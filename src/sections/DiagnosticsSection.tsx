import React, { useEffect, useState, useCallback } from 'react'
import { Database, AlertCircle, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { GlowingCard } from '../components/GlowingCard'
import { SectionTitle } from '../components/SectionTitle'

const API_BASE = 'http://127.0.0.1:8000'

// ── Types ─────────────────────────────────────────────────────────
interface PLCSensorReading {
  label: string
  value: string
  unit: string
  trend: 'stable' | 'rising' | 'falling'
}

interface PLCDiagnosticItem {
  title: string
  value: string
  detail: string
  variant: 'ok' | 'warning' | 'error'
}

// ── Offline Fallbacks ─────────────────────────────────────────────
const offlineSensors: PLCSensorReading[] = [
  { label: 'Fabric Tension', value: '--', unit: 'N',  trend: 'stable' },
  { label: 'Edge Alignment', value: '--', unit: 'mm', trend: 'stable' },
  { label: 'Roller Current', value: '--', unit: 'A',  trend: 'stable' },
  { label: 'Ambient Temp',   value: '--', unit: '°C', trend: 'stable' },
]

const offlineDiagnostics: PLCDiagnosticItem[] = [
  {
    title: 'PLC Status',
    value: 'Offline',
    detail: 'Connection lost — check cable or IP',
    variant: 'error',
  },
  {
    title: 'Network Link',
    value: 'Down',
    detail: 'Check PLC cable or IP address',
    variant: 'warning',
  },
  {
    title: 'Control Health',
    value: 'No data',
    detail: 'Awaiting PLC response',
    variant: 'warning',
  },
]

// ── Trend Icon ────────────────────────────────────────────────────
const TrendIcon = ({ trend }: { trend: 'stable' | 'rising' | 'falling' }) => {
  if (trend === 'rising')  return <TrendingUp  className="w-3 h-3 text-emerald-500" />
  if (trend === 'falling') return <TrendingDown className="w-3 h-3 text-amber-500"  />
  return <Minus className="w-3 h-3 text-slate-400" />
}

// ── Main Component ────────────────────────────────────────────────
export const DiagnosticsSection: React.FC = () => {
  const [sensors,      setSensors]      = useState<PLCSensorReading[]>(offlineSensors)
  const [diagnostics,  setDiagnostics]  = useState<PLCDiagnosticItem[]>(offlineDiagnostics)
  const [plcConnected, setPlcConnected] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [lastFetched,  setLastFetched]  = useState<string | null>(null)

  // ── Fetch from PLC with timeout ──────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 500)

      const [sensorRes, diagRes] = await Promise.all([
        fetch(`${API_BASE}/api/plc/sensors`, { signal: controller.signal }),
        fetch(`${API_BASE}/api/plc/diagnostics`, { signal: controller.signal }),
      ])
      clearTimeout(timeoutId)

      const sensorJson = await sensorRes.json()
      const diagJson   = await diagRes.json()

      const connected = sensorJson.connected || diagJson.connected
      setPlcConnected(connected)

      setSensors(
        sensorJson.connected && sensorJson.sensors?.length > 0
          ? sensorJson.sensors
          : offlineSensors
      )

      setDiagnostics(
        diagJson.connected && diagJson.diagnostics?.length > 0
          ? diagJson.diagnostics
          : offlineDiagnostics
      )

      // Record when data was last fetched
      setLastFetched(new Date().toLocaleTimeString())

    } catch {
      setPlcConnected(false)
      setSensors(offlineSensors)
      setDiagnostics(offlineDiagnostics)
      setLastFetched(new Date().toLocaleTimeString())
    }

    setLoading(false)
  }, [])

  // ── Defer fetch to after initial render ──────────────────────
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      if (active) load()
    }, 300)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [load])

  return (
    <section className="w-full mt-4">

      {/* ── Title + Refresh Button Row ── */}
      <div className="flex items-center justify-between mb-1">
        <SectionTitle title="System Diagnostics" subtitle="Sensors & Health" />

        <div className="flex items-center gap-3 self-start mt-1">

          {/* Last fetched timestamp */}
          {lastFetched && (
            <span className="text-[10px] text-slate-400 font-mono hidden sm:block">
              Last read: {lastFetched}
            </span>
          )}

          {/* Refresh Button */}
          <button
            onClick={load}
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Sensor Values ─────────────────────────────────────── */}
        <GlowingCard className="col-span-1 lg:col-span-2 p-6" strong>
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
            Live Sensor Feed
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sensors.map((item, index) => (
              <div
                key={index}
                className={`
                  rounded-2xl p-4 border border-slate-200/70 bg-white/60 backdrop-blur-sm
                  flex items-center gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)]
                  hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-shadow
                  ${loading ? 'opacity-50' : 'opacity-100'}
                `}
              >
                <div className={`p-3 rounded-xl flex-shrink-0 ${
                  item.trend === 'rising'
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/15'
                    : item.trend === 'falling'
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/15'
                    : 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/15'
                }`}>
                  <Database className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em]">
                      {item.label}
                    </div>
                    <TrendIcon trend={item.trend} />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xl font-bold text-slate-800 metric-display">
                      {item.value}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {item.unit}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Voltage history — only shown when PLC connected */}
          {plcConnected && (
            <div className="mt-5 pt-5 border-t border-slate-200/60">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                  Voltage History
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Snapshot at {lastFetched}
                </span>
              </div>
              <div className="h-16 flex items-end gap-1">
                {[65, 72, 68, 75, 80, 78, 82, 85, 83, 88, 90, 87, 92, 95, 93, 96, 94, 98, 100, 97].map(
                  (h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-cyan-500/20 hover:bg-cyan-500/40 transition-colors"
                      style={{ height: `${h}%` }}
                    />
                  )
                )}
              </div>
            </div>
          )}
        </GlowingCard>

        {/* ── Diagnostics Panel ─────────────────────────────────── */}
        <GlowingCard className="col-span-1 p-6" active>
          <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            System Diagnostics
          </h3>

          <div className="flex flex-col gap-3">
            {diagnostics.map((item, index) => (
              <div
                key={index}
                className={`
                  rounded-xl px-4 py-3 border text-xs uppercase tracking-[0.1em] font-mono font-medium
                  ${loading ? 'opacity-50' : 'opacity-100'}
                  ${item.variant === 'ok'
                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
                    : item.variant === 'warning'
                    ? 'border-amber-200 bg-amber-50/70 text-amber-700'
                    : 'border-red-200 bg-red-50/70 text-red-700'
                  }
                `}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{item.title}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500">
                  {item.detail}
                </div>
              </div>
            ))}
          </div>

          {/* ── System Health Ring ── */}
          <div className="mt-5 pt-5 border-t border-slate-200/60">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
              System Health
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 flex-shrink-0">
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
                    strokeDasharray={plcConnected ? '92, 100' : '20, 100'}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-700 font-mono">
                  {plcConnected ? 'OK' : 'OFF'}
                </span>
              </div>

              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-700">
                  {plcConnected ? 'PLC online' : 'PLC offline'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {plcConnected
                    ? 'Live sensor and diagnostic data active'
                    : 'Waiting for PLC connection'}
                </div>
              </div>
            </div>
          </div>
        </GlowingCard>

      </div>
    </section>
  )
}