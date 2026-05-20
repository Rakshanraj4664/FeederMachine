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
const RAIL_LENGTH_MM = 2400
const PLATE_WIDTH_MM = 160
const MIN_GAP_MM = 800
const MAX_GAP_MM = 2000
const MAX_OFFSET_MM = 400

const GAP_REGISTER = 500
const OFFSET_REGISTER = 501

const mmToPct = (mm: number) => (mm / RAIL_LENGTH_MM) * 100

const clamp = (v: number, min: number, max: number) => {
  if (v < min) return min
  if (v > max) return max
  return v
}

// ═══════════════════════════════════════════════════════════════
// ANIMATED NUMBER COMPONENT
// ═══════════════════════════════════════════════════════════════
function AnimatedValue({
  value,
  decimals = 0,
  unit = ''
}: {
  value: number
  decimals?: number
  unit?: string
}) {
  const [display, setDisplay] = useState(value)
  const spring = useSpring(value, { stiffness: 120, damping: 20 })

  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  useEffect(() => {
    const unsub = spring.on('change', (v) =>
      setDisplay(Number(v.toFixed(decimals)))
    )
    return unsub
  }, [spring, decimals])

  return (
    <span className="metric-display">
      {display}
      {unit && <span className="text-slate-400 ml-1">{unit}</span>}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const WidthControlSection: React.FC = () => {
  // ── State ──
  const [leftPlateOuter, setLeftPlateOuter] = useState(400)
  const [rightPlateOuter, setRightPlateOuter] = useState(2000)
  const [activeAction, setActiveAction] = useState<string | null>(null)

  // Step sizes
  const [expandCompressStep, setExpandCompressStep] = useState(50)
  const [moveStep, setMoveStep] = useState(20)

  // Input focus states
  const [gapFocused, setGapFocused] = useState(false)
  const [offsetFocused, setOffsetFocused] = useState(false)
  const [plcConnected, setPlcConnected] = useState(false)

  // ═══════════════════════════════════════════════════════════
  // DERIVED VALUES
  // ═══════════════════════════════════════════════════════════
  const leftPlateInnerMM = leftPlateOuter + PLATE_WIDTH_MM
  const rightPlateInnerMM = rightPlateOuter - PLATE_WIDTH_MM
  const innerGap = rightPlateInnerMM - leftPlateInnerMM
  const railMidpoint = RAIL_LENGTH_MM / 2
  const gapCenterMM = (leftPlateInnerMM + rightPlateInnerMM) / 2
  const offset = gapCenterMM - railMidpoint

  // Spring animations
  const leftSpring = useSpring(leftPlateOuter, { stiffness: 80, damping: 18 })
  const rightSpring = useSpring(rightPlateOuter, { stiffness: 80, damping: 18 })

  useEffect(() => {
    animate(leftSpring, leftPlateOuter, {
      type: 'spring',
      stiffness: 80,
      damping: 18
    })
  }, [leftPlateOuter, leftSpring])

  useEffect(() => {
    animate(rightSpring, rightPlateOuter, {
      type: 'spring',
      stiffness: 80,
      damping: 18
    })
  }, [rightPlateOuter, rightSpring])

  // ═══════════════════════════════════════════════════════════
  // BOUNDARY CHECKS
  // ═══════════════════════════════════════════════════════════
  const isAtMinGap = innerGap <= MIN_GAP_MM
  const isAtMaxGap = innerGap >= MAX_GAP_MM
  const isAtLeftRail = leftPlateOuter <= 0.5
  const isAtRightRail = rightPlateOuter >= RAIL_LENGTH_MM - 0.5
  const isAtMinOffset = offset <= -MAX_OFFSET_MM
  const isAtMaxOffset = offset >= MAX_OFFSET_MM

  // both sides fully against the rails — expand impossible
  const isFullyExpanded = isAtLeftRail && isAtRightRail

  // ── PLC Write Helper ──
  const writePlcValue = useCallback(
    async (address: number, value: number) => {
      try {
        await writePlcRegister(address, value)
      } catch {
        // ignore write failure
      }
    },
    []
  )

  // ── Trigger Animation ──
  const trigger = useCallback((action: string, dur = 300) => {
    setActiveAction(action)
    setTimeout(() => setActiveAction(null), dur)
  }, [])

  // ═══════════════════════════════════════════════════════════
  // MOVEMENT HANDLERS
  // ═══════════════════════════════════════════════════════════

  // EXPAND — redistributes unused movement to the opposite side
  const handleExpand = useCallback(() => {
    const step = expandCompressStep

    let newLeft = leftPlateOuter - step
    let newRight = rightPlateOuter + step

    // Left plate hits rail — give unused portion to the right
    if (newLeft < 0) {
      const leftover = -newLeft
      newLeft = 0
      newRight = Math.min(RAIL_LENGTH_MM, newRight + leftover)
    }

    // Right plate hits rail — give unused portion to the left
    if (newRight > RAIL_LENGTH_MM) {
      const leftover = newRight - RAIL_LENGTH_MM
      newRight = RAIL_LENGTH_MM
      newLeft = Math.max(0, newLeft - leftover)
    }

    // Only update if something actually changed
    if (newLeft !== leftPlateOuter || newRight !== rightPlateOuter) {
      trigger('expand')
      setLeftPlateOuter(newLeft)
      setRightPlateOuter(newRight)
      const newInnerGap =
        newRight - PLATE_WIDTH_MM - (newLeft + PLATE_WIDTH_MM)
      writePlcValue(GAP_REGISTER, newInnerGap)
    }
  }, [
    leftPlateOuter,
    rightPlateOuter,
    expandCompressStep,
    trigger,
    writePlcValue
  ])

  // COMPRESS — symmetrical, capped at MIN_GAP
  const handleCompress = useCallback(() => {
    if (innerGap <= MIN_GAP_MM) return

    const maxTotalStep = innerGap - MIN_GAP_MM
    const perSide = Math.min(expandCompressStep, Math.floor(maxTotalStep / 2))

    if (perSide <= 0) return

    let newLeft = leftPlateOuter + perSide
    let newRight = rightPlateOuter - perSide

    // Safety clamp — ensure min gap is never breached
    const resultGap =
      newRight - PLATE_WIDTH_MM - (newLeft + PLATE_WIDTH_MM)
    if (resultGap < MIN_GAP_MM) {
      const center = (leftPlateOuter + rightPlateOuter) / 2
      const totalSpan = MIN_GAP_MM + PLATE_WIDTH_MM * 2
      newLeft = center - totalSpan / 2
      newRight = center + totalSpan / 2
    }

    trigger('contract')
    setLeftPlateOuter(newLeft)
    setRightPlateOuter(newRight)
    const newInnerGap =
      newRight - PLATE_WIDTH_MM - (newLeft + PLATE_WIDTH_MM)
    writePlcValue(GAP_REGISTER, newInnerGap)
  }, [
    leftPlateOuter,
    rightPlateOuter,
    innerGap,
    expandCompressStep,
    trigger,
    writePlcValue
  ])

  // MOVE LEFT — keeps gap constant, shifts whole assembly left
  const handleMoveLeft = useCallback(() => {
    const span = rightPlateOuter - leftPlateOuter
    const newLeft = Math.max(0, leftPlateOuter - moveStep)
    const newRight = newLeft + span

    if (newRight <= RAIL_LENGTH_MM) {
      trigger('moveLeft')
      setLeftPlateOuter(newLeft)
      setRightPlateOuter(newRight)
      writePlcValue(GAP_REGISTER, innerGap)
    }
  }, [leftPlateOuter, rightPlateOuter, innerGap, moveStep, trigger, writePlcValue])

  // MOVE RIGHT — keeps gap constant, shifts whole assembly right
  const handleMoveRight = useCallback(() => {
    const span = rightPlateOuter - leftPlateOuter
    const newRight = Math.min(RAIL_LENGTH_MM, rightPlateOuter + moveStep)
    const newLeft = newRight - span

    if (newLeft >= 0) {
      trigger('moveRight')
      setLeftPlateOuter(newLeft)
      setRightPlateOuter(newRight)
      writePlcValue(GAP_REGISTER, innerGap)
    }
  }, [leftPlateOuter, rightPlateOuter, innerGap, moveStep, trigger, writePlcValue])

  // RESET — centres assembly with minimum gap
  const handleReset = useCallback(() => {
    trigger('reset', 500)
    const totalSpan = MIN_GAP_MM + PLATE_WIDTH_MM * 2
    const defaultLeft = (RAIL_LENGTH_MM - totalSpan) / 2
    const defaultRight = defaultLeft + totalSpan
    setLeftPlateOuter(defaultLeft)
    setRightPlateOuter(defaultRight)
  }, [trigger])

  // ── Direct Input Setters ──
  const setGapDirect = useCallback(
    (newGap: number) => {
      const clampedGap = clamp(newGap, MIN_GAP_MM, MAX_GAP_MM)
      const totalSpan = clampedGap + PLATE_WIDTH_MM * 2
      const currentCenter = (leftPlateOuter + rightPlateOuter) / 2
      let newLeft = currentCenter - totalSpan / 2
      let newRight = currentCenter + totalSpan / 2

      if (newLeft < 0) {
        newLeft = 0
        newRight = totalSpan
      }
      if (newRight > RAIL_LENGTH_MM) {
        newRight = RAIL_LENGTH_MM
        newLeft = RAIL_LENGTH_MM - totalSpan
      }

      if (newLeft >= 0 && newRight <= RAIL_LENGTH_MM) {
        setLeftPlateOuter(newLeft)
        setRightPlateOuter(newRight)
        writePlcValue(GAP_REGISTER, clampedGap)
      }
    },
    [leftPlateOuter, rightPlateOuter, writePlcValue]
  )

  const setOffsetDirect = useCallback(
    (newOffset: number) => {
      const clampedOffset = clamp(newOffset, -MAX_OFFSET_MM, MAX_OFFSET_MM)
      const totalSpan = rightPlateOuter - leftPlateOuter
      const newCenter = railMidpoint + clampedOffset
      const newLeft = newCenter - totalSpan / 2
      const newRight = newCenter + totalSpan / 2

      if (newLeft >= 0 && newRight <= RAIL_LENGTH_MM) {
        setLeftPlateOuter(newLeft)
        setRightPlateOuter(newRight)
        writePlcValue(OFFSET_REGISTER, clampedOffset)
      }
    },
    [leftPlateOuter, rightPlateOuter, railMidpoint, writePlcValue]
  )

  // ── Increment Helpers ──
  const onGapIncrement = (delta: number) => setGapDirect(innerGap + delta)
  const onOffsetIncrement = (delta: number) => setOffsetDirect(offset + delta)

  // ── PLC Sync ──
  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (!active) return
      const widthState = await getPlcWidth()
      setPlcConnected(widthState.connected)
      if (widthState.connected) {
        const mid = RAIL_LENGTH_MM / 2
        const gapCenter = mid + widthState.offset
        const lo = gapCenter - widthState.gap / 2 - PLATE_WIDTH_MM
        const ro = gapCenter + widthState.gap / 2 + PLATE_WIDTH_MM
        setLeftPlateOuter(lo)
        setRightPlateOuter(ro)
      }
    }

    refresh()
    const interval = setInterval(refresh, 2000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════
  // PERCENTAGE CONVERSIONS FOR RENDERING
  // ═══════════════════════════════════════════════════════════
  const leftPlateOuterPct = mmToPct(leftPlateOuter)
  const leftPlateInnerPct = mmToPct(leftPlateInnerMM)
  const rightPlateInnerPct = mmToPct(rightPlateInnerMM)
  const gapCenterPct = mmToPct(gapCenterMM)
  const innerGapPct = mmToPct(innerGap)
  const plateWidthPct = mmToPct(PLATE_WIDTH_MM)

  return (
    <section className="w-full">
      <SectionTitle
        title="Width Control"
        subtitle="Fabric sizing and plate alignment"
      />

      <GlowingCard
        className="p-6 md:p-8"
        active={activeAction !== null}
        pulse={activeAction !== null}
      >
        <div className="flex flex-col gap-6">

          {/* ── TOP ROW ── */}
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="label-industrial">Top view — Physical layout</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-800">
                Fabric guide & plate spacing
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
                The fabric spans the gap between plates. Controls will NOT move
                plates beyond physical limits.
              </p>
              <div
                className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold ${
                  plcConnected
                    ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200'
                    : 'bg-red-500/10 text-red-700 border border-red-200'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    plcConnected ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                {plcConnected ? 'PLC sync active' : 'PLC offline'}
              </div>
            </div>

            {/* ── MM INPUT BOXES ── */}
            <div className="flex flex-col sm:flex-row gap-3">

              {/* Gap Input */}
              <div
                className={`rounded-2xl border px-5 py-4 transition-all duration-200 min-w-[180px] ${
                  gapFocused
                    ? 'border-cyan-400 bg-cyan-50/50 shadow-[0_0_24px_rgba(6,182,212,0.12)]'
                    : 'border-slate-200/80 bg-white/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)]'
                }`}
              >
                <label className="label-industrial block mb-2">
                  Gap Width (mm)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onGapIncrement(-10)}
                    disabled={isAtMinGap}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition-all"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="w-24 text-center font-mono text-2xl font-bold text-slate-800">
                    <AnimatedValue value={Math.round(innerGap)} />
                    <span className="text-slate-400 text-sm ml-0.5">mm</span>
                  </div>
                  <button
                    onClick={() => onGapIncrement(10)}
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
              <div
                className={`rounded-2xl border px-5 py-4 transition-all duration-200 min-w-[180px] ${
                  offsetFocused
                    ? 'border-cyan-400 bg-cyan-50/50 shadow-[0_0_24px_rgba(6,182,212,0.12)]'
                    : 'border-slate-200/80 bg-white/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)]'
                }`}
              >
                <label className="label-industrial block mb-2">
                  Center Offset (mm)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOffsetIncrement(-10)}
                    disabled={isAtMinOffset || isAtLeftRail}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 transition-all"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="w-24 text-center font-mono text-2xl font-bold text-slate-800">
                    <AnimatedValue value={Math.round(offset)} />
                    <span className="text-slate-400 text-sm ml-0.5">mm</span>
                  </div>
                  <button
                    onClick={() => onOffsetIncrement(10)}
                    disabled={isAtMaxOffset || isAtRightRail}
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

          {/* ── STEP SIZE CONTROLS ── */}
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="rounded-xl border border-slate-200/80 bg-white/60 px-4 py-3">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Expand/Compress Step
              </label>
              <input
                type="number"
                value={expandCompressStep}
                onChange={(e) =>
                  setExpandCompressStep(Number(e.target.value) || 10)
                }
                onFocus={() => setGapFocused(true)}
                onBlur={() => setGapFocused(false)}
                className="w-full bg-transparent font-mono text-lg font-bold text-slate-800 outline-none"
                min="1"
                max="200"
              />
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/60 px-4 py-3">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Move Step
              </label>
              <input
                type="number"
                value={moveStep}
                onChange={(e) => setMoveStep(Number(e.target.value) || 10)}
                onFocus={() => setOffsetFocused(true)}
                onBlur={() => setOffsetFocused(false)}
                className="w-full bg-transparent font-mono text-lg font-bold text-slate-800 outline-none"
                min="1"
                max="200"
              />
            </div>
          </div>

          {/* ── METRICS ROW ── */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {[
              { label: 'Inner Gap', value: innerGap, unit: 'mm', decimals: 0 },
              { label: 'Offset', value: offset, unit: 'mm', decimals: 0 },
              { label: 'Left Outer', value: leftPlateOuter, unit: 'mm', decimals: 0 },
              { label: 'Right Outer', value: rightPlateOuter, unit: 'mm', decimals: 0 }
            ].map((m, i) => (
              <motion.div
                key={i}
                className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
                animate={{ scale: activeAction ? [1, 1.02, 1] : 1 }}
                transition={{ duration: 0.2 }}
              >
                <p className="label-industrial">{m.label}</p>
                <p className="mt-1.5 text-xl font-bold text-slate-800">
                  <AnimatedValue
                    value={m.value}
                    decimals={m.decimals}
                    unit={m.unit}
                  />
                </p>
              </motion.div>
            ))}
          </div>

          {/* ── VISUALIZATION ── */}
          <div className="rounded-[2rem] border border-slate-200/80 bg-slate-100/50 p-4 md:p-6 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="relative h-[280px] overflow-hidden rounded-[1.5rem] border border-slate-300/60 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)]">

              {/* Rail end labels */}
              <div className="absolute inset-x-4 top-2 flex justify-between text-[10px] font-mono font-bold text-slate-400">
                <span>0 mm</span>
                <span className="text-cyan-600">
                  {railMidpoint} mm (CENTER)
                </span>
                <span>{RAIL_LENGTH_MM} mm</span>
              </div>

              {/* Guide rails */}
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
                {Math.abs(offset) > 0.5 && (
                  <motion.div
                    className="absolute top-6 bottom-6 w-0.5 bg-amber-500/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, left: `${gapCenterPct}%` }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                  >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-[9px] font-mono font-bold text-amber-600 bg-amber-50/80 px-1.5 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">
                      {offset > 0 ? '+' : ''}
                      {Math.round(offset)}mm
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* THE MOVING ASSEMBLY */}
              <div className="absolute inset-y-16 inset-x-10">

                {/* FABRIC — spans exactly between the two inner edges */}
                <motion.div
                  className="absolute top-1/2 h-24 -translate-y-1/2 rounded-full bg-cyan-500/20 border-2 border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)] overflow-hidden"
                  animate={{
                    left: `${leftPlateInnerPct}%`,
                    width: `${innerGapPct}%`
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 70,
                    damping: 16,
                    mass: 0.9
                  }}
                >
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_6px,rgba(6,182,212,0.06)_6px,rgba(6,182,212,0.06)_8px)]" />
                  <div className="absolute inset-0 flex items-center justify-center px-2">
                    <motion.span className="text-sm font-black text-cyan-700/70 font-mono bg-white/90 px-3 py-1 rounded-full backdrop-blur-sm border border-cyan-200/50 shadow-sm flex-shrink-0">
                      <AnimatedValue value={Math.round(innerGap)} unit="mm" />
                    </motion.span>
                  </div>
                </motion.div>

                {/* LEFT PLATE */}
                <motion.div
                  className={`absolute top-1/2 h-24 -translate-y-1/2 rounded-r-xl border-2 flex items-center justify-center z-10 ${
                    isAtLeftRail
                      ? 'bg-red-500/30 border-red-600 shadow-[0_0_24px_rgba(239,68,68,0.3)]'
                      : 'bg-slate-800 border-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.15)]'
                  }`}
                  style={{ width: `${plateWidthPct}%` }}
                  animate={{ left: `${leftPlateOuterPct}%` }}
                  transition={{
                    type: 'spring',
                    stiffness: 70,
                    damping: 16,
                    mass: 0.9
                  }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-base font-black uppercase tracking-[0.25em] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      LEFT
                    </span>
                    <span className="text-[10px] font-mono text-white/60 font-medium">
                      {Math.round(leftPlateOuter)}mm
                    </span>
                  </div>
                  {/* Inner-edge connector dot */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_rgba(6,182,212,0.6)] z-20" />
                </motion.div>

                {/* RIGHT PLATE */}
                <motion.div
                  className={`absolute top-1/2 h-24 -translate-y-1/2 rounded-l-xl border-2 flex items-center justify-center z-10 ${
                    isAtRightRail
                      ? 'bg-red-500/30 border-red-600 shadow-[0_0_24px_rgba(239,68,68,0.3)]'
                      : 'bg-slate-800 border-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.15)]'
                  }`}
                  style={{ width: `${plateWidthPct}%` }}
                  animate={{ left: `${rightPlateInnerPct}%` }}
                  transition={{
                    type: 'spring',
                    stiffness: 70,
                    damping: 16,
                    mass: 0.9
                  }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-base font-black uppercase tracking-[0.25em] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      RIGHT
                    </span>
                    <span className="text-[10px] font-mono text-white/60 font-medium">
                      {Math.round(rightPlateOuter)}mm
                    </span>
                  </div>
                  {/* Inner-edge connector dot */}
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
                      <div
                        className={`w-px bg-slate-400/50 ${
                          isMajor ? 'h-3' : 'h-1.5'
                        }`}
                      />
                      {isMajor && (
                        <span className="text-[8px] font-mono text-slate-400 mt-0.5">
                          {mm}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── CONTROL BUTTONS ── */}
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
              onClick={handleCompress}
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
              disabled={isFullyExpanded}
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

            <IndustrialButton
              size="lg"
              variant="ghost"
              onClick={handleReset}
              active={activeAction === 'reset'}
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </IndustrialButton>
          </div>

          {/* ── STATUS BAR ── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  isAtLeftRail || isAtRightRail || isAtMaxGap || isAtMinGap
                    ? 'bg-red-500 animate-pulse'
                    : 'bg-emerald-500'
                }`}
              />
              <span className="text-slate-600 font-medium">
                {isAtLeftRail || isAtRightRail || isAtMaxGap || isAtMinGap
                  ? 'AT LIMIT — Cannot move further'
                  : 'Within limits'}
              </span>
            </div>

            <div className="h-3 w-px bg-slate-300 hidden sm:block" />

            <span className="text-slate-500 font-mono">
              Rail: {RAIL_LENGTH_MM}mm
            </span>
            <span className="text-slate-500 font-mono">
              Plate: {PLATE_WIDTH_MM}mm
            </span>
            <span className="text-slate-500 font-mono">
              Gap: {MIN_GAP_MM}–{MAX_GAP_MM}mm
            </span>
            <span className="text-slate-500 font-mono">
              Step: ±{expandCompressStep}/{moveStep}mm
            </span>

            {(isAtMinGap || isAtMaxGap || isAtLeftRail || isAtRightRail) && (
              <>
                <div className="h-3 w-px bg-slate-300 hidden sm:block" />
                <span className="text-red-600 font-medium">
                  {isAtLeftRail && 'LEFT RAIL '}
                  {isAtRightRail && 'RIGHT RAIL '}
                  {isAtMinGap && 'MIN GAP '}
                  {isAtMaxGap && 'MAX GAP '}
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