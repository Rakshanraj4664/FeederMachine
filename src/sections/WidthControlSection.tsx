import React, { useState, useCallback, useEffect } from 'react'
import { motion, useSpring, animate, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeftToLine, 
  ArrowRightToLine, 
  ChevronsLeftRight, 
  ChevronsRightLeft, 
  Minus,
  Plus,
  RotateCcw
} from 'lucide-react'
import { GlowingCard } from '../components/GlowingCard'
import { IndustrialButton } from '../components/IndustrialButton'
import { SectionTitle } from '../components/SectionTitle'
import { getPlcWidth, writePlcRegister } from '../services/plc'

// ═══════════════════════════════════════════════════════════════
// PHYSICAL CONSTANTS — All in millimeters
// ═══════════════════════════════════════════════════════════════
const RAIL_LENGTH_MM = 2400      // Total rail/track length
const PLATE_WIDTH_MM = 160       // Width of each metal plate
const MIN_GAP_MM = 800           // Minimum gap between plate inner edges
const MAX_GAP_MM = 2000          // Maximum gap between plate inner edges
const MAX_OFFSET_MM = 400        // Max center offset from rail midpoint (±)
const GAP_REGISTER = 500
const OFFSET_REGISTER = 501

// Convert mm to percentage for rendering
const mmToPct = (mm: number) => (mm / RAIL_LENGTH_MM) * 100

// Hard clamp function — prevents ANY value outside bounds
const clamp = (v: number, min: number, max: number) => {
  if (v < min) return min
  if (v > max) return max
  return v
}

// ═══════════════════════════════════════════════════════════════
// ANIMATED NUMBER COMPONENT
// ═══════════════════════════════════════════════════════════════
function AnimatedValue({ value, decimals = 0, unit = '' }: { value: number; decimals?: number; unit?: string }) {
  const [display, setDisplay] = useState(value)
  const spring = useSpring(value, { stiffness: 120, damping: 20 })

  useEffect(() => { spring.set(value) }, [value, spring])
  useEffect(() => {
    const unsub = spring.on('change', (v) => setDisplay(Number(v.toFixed(decimals))))
    return unsub
  }, [spring, decimals])

  return <span className="metric-display">{display}{unit && <span className="text-slate-400 ml-1">{unit}</span>}</span>
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const WidthControlSection: React.FC = () => {
  // ── State ──
  const [gap, setGap] = useState(1250)           // Distance between plate inner edges (mm)
  const [offset, setOffset] = useState(0)        // Offset from rail center (mm, ±)
  const [activeAction, setActiveAction] = useState<string | null>(null)

  // Input states
  const [gapInput, setGapInput] = useState('1250')
  const [offsetInput, setOffsetInput] = useState('0')
  const [gapFocused, setGapFocused] = useState(false)
  const [offsetFocused, setOffsetFocused] = useState(false)
  const [plcConnected, setPlcConnected] = useState(false)

  // Spring animations for smooth visual updates
  const gapSpring = useSpring(gap, { stiffness: 80, damping: 18 })
  const offsetSpring = useSpring(offset, { stiffness: 80, damping: 18 })

  useEffect(() => { animate(gapSpring, gap, { type: 'spring', stiffness: 80, damping: 18 }) }, [gap, gapSpring])
  useEffect(() => { animate(offsetSpring, offset, { type: 'spring', stiffness: 80, damping: 18 }) }, [offset, offsetSpring])

  // ── Computed Positions ──
  const railMidpoint = RAIL_LENGTH_MM / 2
  const gapCenter = railMidpoint + offset
  const leftPlateInner = gapCenter - gap / 2
  const rightPlateInner = gapCenter + gap / 2
  const leftPlateOuter = leftPlateInner - PLATE_WIDTH_MM
  const rightPlateOuter = rightPlateInner + PLATE_WIDTH_MM

  // ═══════════════════════════════════════════════════════════
  // BOUNDARY CHECKS — HARD LIMITS
  // ═══════════════════════════════════════════════════════════
  const isAtMinGap = gap <= MIN_GAP_MM
  const isAtMaxGap = gap >= MAX_GAP_MM
  const isAtMinOffset = offset <= -MAX_OFFSET_MM
  const isAtMaxOffset = offset >= MAX_OFFSET_MM
  const isAtLeftRail = leftPlateOuter <= 0.5        // Left plate touching left end (with small tolerance)
  const isAtRightRail = rightPlateOuter >= RAIL_LENGTH_MM - 0.5  // Right plate touching right end

  // ── Safe state setters with hard clamping ──
  const writePlcValue = useCallback(async (address: number, value: number) => {
    try {
      await writePlcRegister(address, value)
    } catch {
      // ignore write failure; UI state remains updated locally
    }
  }, [])

  const setGapClamped = useCallback((newGap: number) => {
    const clamped = clamp(newGap, MIN_GAP_MM, MAX_GAP_MM)
    setGap(clamped)
    setGapInput(clamped.toString())
    writePlcValue(GAP_REGISTER, clamped)
  }, [writePlcValue])

  const setOffsetClamped = useCallback((newOffset: number) => {
    const clamped = clamp(newOffset, -MAX_OFFSET_MM, MAX_OFFSET_MM)
    setOffset(clamped)
    setOffsetInput(clamped.toString())
    writePlcValue(OFFSET_REGISTER, clamped)
  }, [writePlcValue])

  // ── Movement actions with PROPER LIMIT CHECKS ──
  const trigger = useCallback((action: string, dur = 300) => {
    setActiveAction(action)
    setTimeout(() => setActiveAction(null), dur)
  }, [])

  const handleExpand = useCallback(() => {
    const newGap = gap + 50
    // Check if new gap would exceed MAX_GAP_MM
    if (newGap > MAX_GAP_MM) {
      // If it would exceed, set to max instead
      if (gap !== MAX_GAP_MM) {
        trigger('expand')
        setGapClamped(MAX_GAP_MM)
      }
      return
    }
    trigger('expand')
    setGapClamped(newGap)
  }, [gap, setGapClamped, trigger])

  const handleContract = useCallback(() => {
    const newGap = gap - 50
    // Check if new gap would go below MIN_GAP_MM
    if (newGap < MIN_GAP_MM) {
      // If it would go below, set to min instead
      if (gap !== MIN_GAP_MM) {
        trigger('contract')
        setGapClamped(MIN_GAP_MM)
      }
      return
    }
    trigger('contract')
    setGapClamped(newGap)
  }, [gap, setGapClamped, trigger])

  const handleMoveLeft = useCallback(() => {
    const newOffset = offset - 20
    // Check if moving left would cause left plate to hit rail end
    const newLeftPlateOuter = (railMidpoint + newOffset - gap / 2) - PLATE_WIDTH_MM
    if (newLeftPlateOuter < 0) {
      // Calculate max possible offset without hitting left rail
      const maxLeftOffset = -(railMidpoint - gap / 2 - PLATE_WIDTH_MM)
      if (offset !== maxLeftOffset) {
        trigger('moveLeft')
        setOffsetClamped(maxLeftOffset)
      }
      return
    }
    if (newOffset < -MAX_OFFSET_MM) {
      if (offset !== -MAX_OFFSET_MM) {
        trigger('moveLeft')
        setOffsetClamped(-MAX_OFFSET_MM)
      }
      return
    }
    trigger('moveLeft')
    setOffsetClamped(newOffset)
  }, [offset, gap, railMidpoint, setOffsetClamped, trigger])

  const handleMoveRight = useCallback(() => {
    const newOffset = offset + 20
    // Check if moving right would cause right plate to hit rail end
    const newRightPlateOuter = (railMidpoint + newOffset + gap / 2) + PLATE_WIDTH_MM
    if (newRightPlateOuter > RAIL_LENGTH_MM) {
      // Calculate max possible offset without hitting right rail
      const maxRightOffset = RAIL_LENGTH_MM - (railMidpoint + gap / 2 + PLATE_WIDTH_MM)
      if (offset !== maxRightOffset) {
        trigger('moveRight')
        setOffsetClamped(maxRightOffset)
      }
      return
    }
    if (newOffset > MAX_OFFSET_MM) {
      if (offset !== MAX_OFFSET_MM) {
        trigger('moveRight')
        setOffsetClamped(MAX_OFFSET_MM)
      }
      return
    }
    trigger('moveRight')
    setOffsetClamped(newOffset)
  }, [offset, gap, railMidpoint, setOffsetClamped, trigger])

  const handleReset = useCallback(() => {
    trigger('reset', 500)
    setGap(1250)
    setOffset(0)
    setGapInput('1250')
    setOffsetInput('0')
  }, [trigger])

  // ── Input handlers with immediate clamping ──
  const onGapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setGapInput(raw)
    const n = parseFloat(raw)
    if (!isNaN(n)) {
      const clamped = clamp(n, MIN_GAP_MM, MAX_GAP_MM)
      setGap(clamped)
    }
  }

  const onGapBlur = () => {
    setGapFocused(false)
    const n = parseFloat(gapInput)
    if (isNaN(n)) {
      setGapInput(gap.toString())
      return
    }
    const clamped = clamp(n, MIN_GAP_MM, MAX_GAP_MM)
    setGap(clamped)
    setGapInput(clamped.toString())
    writePlcValue(GAP_REGISTER, clamped)
  }

  const onOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setOffsetInput(raw)
    const n = parseFloat(raw)
    if (!isNaN(n)) {
      const clamped = clamp(n, -MAX_OFFSET_MM, MAX_OFFSET_MM)
      setOffset(clamped)
    }
  }

  const onOffsetBlur = () => {
    setOffsetFocused(false)
    const n = parseFloat(offsetInput)
    if (isNaN(n)) {
      setOffsetInput(offset.toString())
      return
    }
    const clamped = clamp(n, -MAX_OFFSET_MM, MAX_OFFSET_MM)
    setOffset(clamped)
    setOffsetInput(clamped.toString())
    writePlcValue(OFFSET_REGISTER, clamped)
  }

  useEffect(() => {
    let active = true
    const refresh = async () => {
      const widthState = await getPlcWidth()
      if (!active) return
      setPlcConnected(widthState.connected)
      if (widthState.connected) {
        setGap(widthState.gap)
        setGapInput(widthState.gap.toString())
        setOffset(widthState.offset)
        setOffsetInput(widthState.offset.toString())
      }
    }

    refresh()
    const interval = setInterval(refresh, 2000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  // Convert to percentages for rendering
  const leftPlateOuterPct = mmToPct(leftPlateOuter)
  const leftPlateInnerPct = mmToPct(leftPlateInner)
  const rightPlateInnerPct = mmToPct(rightPlateInner)
  const gapCenterPct = mmToPct(gapCenter)
  const fabricWidthPct = mmToPct(gap)

  return (
    <section className="w-full">
      <SectionTitle title="Width Control" subtitle="Fabric sizing and plate alignment" />

      <GlowingCard className="p-6 md:p-8" active={activeAction !== null} pulse={activeAction !== null}>
        <div className="flex flex-col gap-6">

          {/* TOP ROW: Description + MM Input Controls */}
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="label-industrial">Top view — Physical layout</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-800">Fabric guide & plate spacing</h3>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
                The fabric spans the gap between plates. Controls will NOT move plates beyond physical limits.
              </p>
              <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold ${plcConnected ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200' : 'bg-red-500/10 text-red-700 border border-red-200'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${plcConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {plcConnected ? 'PLC sync active' : 'PLC offline'}
              </div>
            </div>

            {/* MM INPUT BOXES */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Gap Input */}
              <div className={`
                rounded-2xl border px-5 py-4 transition-all duration-200 min-w-[180px]
                ${gapFocused 
                  ? 'border-cyan-400 bg-cyan-50/50 shadow-[0_0_24px_rgba(6,182,212,0.12)]' 
                  : 'border-slate-200/80 bg-white/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)]'
                }
              `}>
                <label className="label-industrial block mb-2">Gap Width (mm)</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setGapClamped(gap - 10)}
                    disabled={isAtMinGap}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition-all"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={gapInput}
                    onChange={onGapChange}
                    onFocus={() => setGapFocused(true)}
                    onBlur={onGapBlur}
                    className="w-24 text-center bg-transparent font-mono text-2xl font-bold text-slate-800 outline-none metric-display"
                  />
                  <button 
                    onClick={() => setGapClamped(gap + 10)}
                    disabled={isAtMaxGap}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-2 flex justify-between">
                  <span>min {MIN_GAP_MM}</span>
                  <span>max {MAX_GAP_MM}</span>
                </div>
              </div>

              {/* Offset Input */}
              <div className={`
                rounded-2xl border px-5 py-4 transition-all duration-200 min-w-[180px]
                ${offsetFocused 
                  ? 'border-cyan-400 bg-cyan-50/50 shadow-[0_0_24px_rgba(6,182,212,0.12)]' 
                  : 'border-slate-200/80 bg-white/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)]'
                }
              `}>
                <label className="label-industrial block mb-2">Center Offset (mm)</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setOffsetClamped(offset - 10)}
                    disabled={isAtMinOffset}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition-all"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={offsetInput}
                    onChange={onOffsetChange}
                    onFocus={() => setOffsetFocused(true)}
                    onBlur={onOffsetBlur}
                    className="w-24 text-center bg-transparent font-mono text-2xl font-bold text-slate-800 outline-none metric-display"
                  />
                  <button 
                    onClick={() => setOffsetClamped(offset + 10)}
                    disabled={isAtMaxOffset}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-2 flex justify-between">
                  <span>-{MAX_OFFSET_MM}</span>
                  <span>+{MAX_OFFSET_MM}</span>
                </div>
              </div>
            </div>
          </div>

          {/* METRICS ROW */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {[
              { label: 'Gap Width', value: gap, unit: 'mm', decimals: 0 },
              { label: 'Offset', value: offset, unit: 'mm', decimals: 0 },
              { label: 'Left Edge', value: leftPlateOuter, unit: 'mm', decimals: 0 },
              { label: 'Right Edge', value: rightPlateOuter, unit: 'mm', decimals: 0 },
            ].map((m, i) => (
              <motion.div 
                key={i} 
                className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
                animate={{ scale: activeAction ? [1, 1.02, 1] : 1 }}
                transition={{ duration: 0.2 }}
              >
                <p className="label-industrial">{m.label}</p>
                <p className="mt-1.5 text-xl font-bold text-slate-800">
                  <AnimatedValue value={m.value} decimals={m.decimals} unit={m.unit} />
                </p>
              </motion.div>
            ))}
          </div>

          {/* VISUALIZATION — THE RAIL ASSEMBLY */}
          <div className="rounded-[2rem] border border-slate-200/80 bg-slate-100/50 p-4 md:p-6 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="relative h-[280px] overflow-hidden rounded-[1.5rem] border border-slate-300/60 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)]">

              {/* Rail end labels */}
              <div className="absolute inset-x-4 top-2 flex justify-between text-[10px] font-mono font-bold text-slate-400">
                <span>0 mm</span>
                <span className="text-cyan-600">{railMidpoint} mm (CENTER)</span>
                <span>{RAIL_LENGTH_MM} mm</span>
              </div>

              {/* Top and bottom guide rails */}
              <div className="absolute inset-x-10 top-10 h-4 rounded-full bg-slate-300/50 shadow-inner" />
              <div className="absolute inset-x-10 bottom-10 h-4 rounded-full bg-slate-300/50 shadow-inner" />

              {/* Center reference line */}
              <div 
                className="absolute top-8 bottom-8 w-px bg-cyan-500/20"
                style={{ left: `${mmToPct(railMidpoint)}%` }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-[9px] font-mono font-bold text-cyan-500/60 bg-white/80 px-1 rounded">
                  CENTER
                </div>
              </div>

              {/* Offset indicator */}
              <AnimatePresence>
                {offset !== 0 && (
                  <motion.div 
                    className="absolute top-6 bottom-6 w-0.5 bg-amber-500/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, left: `${gapCenterPct}%` }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                  >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-[9px] font-mono font-bold text-amber-600 bg-amber-50/80 px-1.5 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">
                      {offset > 0 ? '+' : ''}{offset}mm
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* THE MOVING ASSEMBLY */}
              <div className="absolute inset-y-16 inset-x-10">

                {/* FABRIC */}
                <motion.div
                  className="absolute top-1/2 h-24 -translate-y-1/2 rounded-full bg-cyan-500/20 border-2 border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)] overflow-hidden"
                  style={{ left: `${leftPlateInnerPct}%`, width: `${fabricWidthPct}%` }}
                  animate={{ left: `${leftPlateInnerPct}%`, width: `${fabricWidthPct}%` }}
                  transition={{ type: 'spring', stiffness: 70, damping: 16, mass: 0.9 }}
                >
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_6px,rgba(6,182,212,0.06)_6px,rgba(6,182,212,0.06)_8px)]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span className="text-sm font-black text-cyan-700/70 font-mono bg-white/90 px-3 py-1 rounded-full backdrop-blur-sm border border-cyan-200/50 shadow-sm">
                      <AnimatedValue value={gap} unit="mm" />
                    </motion.span>
                  </div>
                </motion.div>

                {/* LEFT PLATE */}
                <motion.div
                  className={`
                    absolute top-1/2 h-24 -translate-y-1/2 rounded-r-xl border-2 flex items-center justify-center z-10
                    ${isAtLeftRail 
                      ? 'bg-red-500/30 border-red-600 shadow-[0_0_24px_rgba(239,68,68,0.3)]' 
                      : 'bg-slate-800 border-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.15)]'
                    }
                  `}
                  style={{ left: `${leftPlateOuterPct}%`, width: `${mmToPct(PLATE_WIDTH_MM)}%` }}
                  animate={{ left: `${leftPlateOuterPct}%` }}
                  transition={{ type: 'spring', stiffness: 70, damping: 16, mass: 0.9 }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-base font-black uppercase tracking-[0.25em] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      LEFT
                    </span>
                    <span className="text-[10px] font-mono text-white/60 font-medium">
                      {Math.round(leftPlateOuter)}mm
                    </span>
                  </div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_rgba(6,182,212,0.6)] z-20" />
                </motion.div>

                {/* RIGHT PLATE */}
                <motion.div
                  className={`
                    absolute top-1/2 h-24 -translate-y-1/2 rounded-l-xl border-2 flex items-center justify-center z-10
                    ${isAtRightRail 
                      ? 'bg-red-500/30 border-red-600 shadow-[0_0_24px_rgba(239,68,68,0.3)]' 
                      : 'bg-slate-800 border-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.15)]'
                    }
                  `}
                  style={{ left: `${rightPlateInnerPct}%`, width: `${mmToPct(PLATE_WIDTH_MM)}%` }}
                  animate={{ left: `${rightPlateInnerPct}%` }}
                  transition={{ type: 'spring', stiffness: 70, damping: 16, mass: 0.9 }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-base font-black uppercase tracking-[0.25em] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      RIGHT
                    </span>
                    <span className="text-[10px] font-mono text-white/60 font-medium">
                      {Math.round(rightPlateOuter)}mm
                    </span>
                  </div>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_rgba(6,182,212,0.6)] z-20" />
                </motion.div>

              </div>

              {/* Ruler ticks */}
              <div className="absolute inset-x-10 bottom-3 flex justify-between items-end">
                {Array.from({ length: 13 }, (_, i) => {
                  const mm = Math.round((i / 12) * RAIL_LENGTH_MM)
                  const isMajor = i % 3 === 0
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <div className={`w-px bg-slate-400/50 ${isMajor ? 'h-3' : 'h-1.5'}`} />
                      {isMajor && <span className="text-[8px] font-mono text-slate-400 mt-0.5">{mm}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* CONTROL BUTTONS */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <IndustrialButton 
              size="lg" 
              variant="outline" 
              onClick={handleMoveLeft} 
              active={activeAction === 'moveLeft'}
              disabled={isAtLeftRail}
            >
              <ArrowLeftToLine className="w-5 h-5" />
              <span className="hidden sm:inline">Move Left</span>
              <span className="sm:hidden">Left</span>
            </IndustrialButton>

            <IndustrialButton 
              size="lg" 
              variant="secondary" 
              onClick={handleContract} 
              active={activeAction === 'contract'}
              disabled={isAtMinGap}
            >
              <ChevronsRightLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Contract</span>
              <span className="sm:hidden">In</span>
            </IndustrialButton>

            <IndustrialButton 
              size="lg" 
              variant="accent" 
              onClick={handleExpand} 
              active={activeAction === 'expand'}
              disabled={isAtMaxGap}
            >
              <span className="hidden sm:inline">Expand</span>
              <span className="sm:hidden">Out</span>
              <ChevronsLeftRight className="w-5 h-5" />
            </IndustrialButton>

            <IndustrialButton 
              size="lg" 
              variant="outline" 
              onClick={handleMoveRight} 
              active={activeAction === 'moveRight'}
              disabled={isAtRightRail}
            >
              <span className="hidden sm:inline">Move Right</span>
              <span className="sm:hidden">Right</span>
              <ArrowRightToLine className="w-5 h-5" />
            </IndustrialButton>

            <IndustrialButton size="lg" variant="ghost" onClick={handleReset} active={activeAction === 'reset'}>
              <RotateCcw className="w-5 h-5" />
              Reset
            </IndustrialButton>
          </div>

          {/* STATUS BAR */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${(isAtLeftRail || isAtRightRail || isAtMaxGap || isAtMinGap || isAtMaxOffset || isAtMinOffset) ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-slate-600 font-medium">
                {(isAtLeftRail || isAtRightRail || isAtMaxGap || isAtMinGap || isAtMaxOffset || isAtMinOffset) 
                  ? 'AT LIMIT — Cannot move further' 
                  : 'Within limits'}
              </span>
            </div>

            <div className="h-3 w-px bg-slate-300 hidden sm:block" />

            <span className="text-slate-500 font-mono">Rail: {RAIL_LENGTH_MM}mm</span>
            <span className="text-slate-500 font-mono">Plate: {PLATE_WIDTH_MM}mm</span>
            <span className="text-slate-500 font-mono">Gap: {MIN_GAP_MM}–{MAX_GAP_MM}mm</span>
            <span className="text-slate-500 font-mono">Offset: ±{MAX_OFFSET_MM}mm</span>

            {(isAtMinGap || isAtMaxGap || isAtMinOffset || isAtMaxOffset || isAtLeftRail || isAtRightRail) && (
              <>
                <div className="h-3 w-px bg-slate-300 hidden sm:block" />
                <span className="text-red-600 font-medium">
                  {isAtLeftRail && 'LEFT RAIL '}
                  {isAtRightRail && 'RIGHT RAIL '}
                  {isAtMinGap && 'MIN GAP '}
                  {isAtMaxGap && 'MAX GAP '}
                  {isAtMinOffset && 'MIN OFFSET '}
                  {isAtMaxOffset && 'MAX OFFSET '}
                  — movement blocked
                </span>
              </>
            )}
          </div>

        </div>
      </GlowingCard>
    </section>
  )
}