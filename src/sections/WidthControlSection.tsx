import React, { useState, useEffect, useCallback } from 'react'
import { motion, useSpring, animate, AnimatePresence } from 'framer-motion'
  import {
  Minus,
  Plus,
  Settings,
  ArrowLeftToLine,
  ArrowRightToLine,
  ChevronsLeftRight,
  ChevronsRightLeft,
  RotateCcw,
  Check,
  X
} from 'lucide-react'

import { GlowingCard } from '../components/GlowingCard'
import { SectionTitle } from '../components/SectionTitle'
import type { PLCRollerState } from '../services/plc'
import { getPlcRollers, writePlcRegister, getPlcWidth, writePlcRegister as writePlcRegisterBase } from '../services/plc'


// ═══════════════════════════════════════════════════════════════
// PHYSICAL CONSTANTS — All in millimeters
// ═══════════════════════════════════════════════════════════════
const RAIL_LENGTH_MM = 2400
const PLATE_WIDTH_MM = 160
const MIN_GAP_MM = 1
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

type RollerControl = PLCRollerState & {
  currentSet: number
  currentWidth: number
}

const ROLLER_CURRENT_SET_REGISTERS: Record<string, number> = {
  'RL-1': 520,
  'RL-2': 521,
  'RL-3': 522,
  'RL-4': 523,
}

const ROLLER_CURRENT_WIDTH_REGISTERS: Record<string, number> = {
  'RL-1': 530,
  'RL-2': 531,
  'RL-3': 532,
  'RL-4': 533,
}

const DEFAULT_ROLLERS: RollerControl[] = [
  {
    id: 'RL-1',
    name: 'Infeed Roller',
    speed: 0,
    load: 0,
    status: 'warning',
    currentSet: 400,
    currentWidth: 1100,
  },
  {
    id: 'RL-2',
    name: 'Tension Roller',
    speed: 0,
    load: 0,
    status: 'warning',
    currentSet: 900,
    currentWidth: 1100,
  },
  {
    id: 'RL-3',
    name: 'Guide Roller',
    speed: 0,
    load: 0,
    status: 'warning',
    currentSet: 1400,
    currentWidth: 1100,
  },
  {
    id: 'RL-4',
    name: 'Outfeed Roller',
    speed: 0,
    load: 0,
    status: 'warning',
    currentSet: 1900,
    currentWidth: 1100,
  },
]

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
// EDITABLE FIELD COMPONENT
// ═══════════════════════════════════════════════════════════════
const EditableField: React.FC<{
  value: number
  onSave: (newValue: number) => Promise<void>
  unit: string
  label: string
}> = ({ value, onSave, unit, label }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value.toString())
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    const numValue = parseFloat(editValue)
    if (isNaN(numValue)) {
      setEditValue(value.toString())
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    await onSave(numValue)
    setIsSaving(false)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value.toString())
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 text-xl font-bold text-slate-800 border border-cyan-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
          autoFocus
          step="1"
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-red-600 hover:text-red-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-slate-100 transition-colors rounded-lg p-1 -m-1"
    >
      <div className="mt-2 text-xl font-bold text-slate-900">
        {Math.round(value)} <span className="text-sm text-slate-500">{unit}</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// GUI PLATE CONTROL COMPONENT
// ═══════════════════════════════════════════════════════════════
const PlateControlGUI: React.FC<{
  roller: RollerControl
  rollers: RollerControl[]
  setRollers: React.Dispatch<React.SetStateAction<RollerControl[]>>
  isOpen: boolean
  onClose: () => void
}> = ({ roller, rollers, setRollers, isOpen, onClose }) => {
  // Calculate initial positions based on roller's current values
  const calculateInitialPositions = useCallback(() => {
    const currentSetValue = roller.currentSet
    const currentWidthValue = roller.currentWidth

    // Calculate left and right plate positions
    const totalSpan = currentWidthValue + (PLATE_WIDTH_MM * 2)
    const leftPos = currentSetValue - (totalSpan / 2)
    const rightPos = leftPos + totalSpan

    return {
      left: Math.max(0, Math.min(RAIL_LENGTH_MM - totalSpan, leftPos)),
      right: Math.max(totalSpan, Math.min(RAIL_LENGTH_MM, rightPos))
    }
  }, [roller.currentSet, roller.currentWidth])

  // Plate State - initialize with roller's current values
  const [leftPlateOuter, setLeftPlateOuter] = useState(() => calculateInitialPositions().left)
  const [rightPlateOuter, setRightPlateOuter] = useState(() => calculateInitialPositions().right)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [expandCompressStep, setExpandCompressStep] = useState(50)
  const [moveStep, setMoveStep] = useState(20)
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState<'idle' | 'success' | 'failed'>('idle')
  const [plcConnected, setPlcConnected] = useState(false)

  // Reset positions when roller changes
  useEffect(() => {
    const positions = calculateInitialPositions()
    setLeftPlateOuter(positions.left)
    setRightPlateOuter(positions.right)
  }, [roller, calculateInitialPositions])

  // Derived values
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

  // Boundary checks
  const isAtMaxGap = innerGap >= MAX_GAP_MM
  const isAtLeftRail = leftPlateOuter <= 0.5
  const isAtRightRail = rightPlateOuter >= RAIL_LENGTH_MM - 0.5
  const isAtMinOffset = offset <= -MAX_OFFSET_MM
  const isAtMaxOffset = offset >= MAX_OFFSET_MM
  const isAtMinGap = innerGap <= MIN_GAP_MM
  const isFullyExpanded = isAtLeftRail && isAtRightRail

  // PLC Write Helper
  const writePlcValue = useCallback(async (address: number, value: number): Promise<boolean> => {
    try {
      await writePlcRegisterBase(address, value)
      return true
    } catch (error) {
      console.error('Failed to write to PLC:', error)
      return false
    }
  }, [])

  const syncPlcWidth = useCallback(async (newGap: number, newOffset: number): Promise<boolean> => {
    const gapWritten = await writePlcValue(GAP_REGISTER, Math.round(newGap))
    const offsetWritten = await writePlcValue(OFFSET_REGISTER, Math.round(newOffset))
    return gapWritten && offsetWritten
  }, [writePlcValue])

  const trigger = useCallback((action: string, dur = 300) => {
    setActiveAction(action)
    setTimeout(() => setActiveAction(null), dur)
  }, [])

  // Movement handlers
  const handleExpand = useCallback(() => {
    const step = expandCompressStep
    let newLeft = leftPlateOuter - step
    let newRight = rightPlateOuter + step

    if (newLeft < 0) {
      const leftover = -newLeft
      newLeft = 0
      newRight = Math.min(RAIL_LENGTH_MM, newRight + leftover)
    }
    if (newRight > RAIL_LENGTH_MM) {
      const leftover = newRight - RAIL_LENGTH_MM
      newRight = RAIL_LENGTH_MM
      newLeft = Math.max(0, newLeft - leftover)
    }

    if (newLeft !== leftPlateOuter || newRight !== rightPlateOuter) {
      const newInnerGap = (newRight - PLATE_WIDTH_MM) - (newLeft + PLATE_WIDTH_MM)
      if (newInnerGap >= MIN_GAP_MM) {
        trigger('expand')
        setLeftPlateOuter(newLeft)
        setRightPlateOuter(newRight)
      }
    }
  }, [leftPlateOuter, rightPlateOuter, expandCompressStep, trigger])

  const handleCompress = useCallback(() => {
    const step = expandCompressStep
    let newLeft = leftPlateOuter + step
    let newRight = rightPlateOuter - step

    const newInnerGap = (newRight - PLATE_WIDTH_MM) - (newLeft + PLATE_WIDTH_MM)

    if (newInnerGap >= MIN_GAP_MM && newLeft >= 0 && newRight <= RAIL_LENGTH_MM) {
      trigger('contract')
      setLeftPlateOuter(newLeft)
      setRightPlateOuter(newRight)
    } else if (newInnerGap < MIN_GAP_MM && innerGap > MIN_GAP_MM) {
      const targetGap = MIN_GAP_MM
      const totalSpan = targetGap + (PLATE_WIDTH_MM * 2)
      const center = (leftPlateOuter + rightPlateOuter) / 2
      const newLeftPos = center - totalSpan / 2
      const newRightPos = center + totalSpan / 2

      if (newLeftPos >= 0 && newRightPos <= RAIL_LENGTH_MM) {
        trigger('contract')
        setLeftPlateOuter(newLeftPos)
        setRightPlateOuter(newRightPos)
      }
    }
  }, [leftPlateOuter, rightPlateOuter, expandCompressStep, innerGap, trigger])

  const handleMoveLeft = useCallback(() => {
    const span = rightPlateOuter - leftPlateOuter
    const newLeft = Math.max(0, leftPlateOuter - moveStep)
    const newRight = newLeft + span

    if (newRight <= RAIL_LENGTH_MM) {
      trigger('moveLeft')
      setLeftPlateOuter(newLeft)
      setRightPlateOuter(newRight)
    }
  }, [leftPlateOuter, rightPlateOuter, moveStep, trigger])

  const handleMoveRight = useCallback(() => {
    const span = rightPlateOuter - leftPlateOuter
    const newRight = Math.min(RAIL_LENGTH_MM, rightPlateOuter + moveStep)
    const newLeft = newRight - span

    if (newLeft >= 0) {
      trigger('moveRight')
      setLeftPlateOuter(newLeft)
      setRightPlateOuter(newRight)
    }
  }, [leftPlateOuter, rightPlateOuter, moveStep, trigger])

  const handleReset = useCallback(() => {
    trigger('reset', 500)
    const totalSpan = MIN_GAP_MM + PLATE_WIDTH_MM * 2
    const defaultLeft = (RAIL_LENGTH_MM - totalSpan) / 2
    const defaultRight = defaultLeft + totalSpan
    setLeftPlateOuter(defaultLeft)
    setRightPlateOuter(defaultRight)
  }, [trigger])

  const handleSet = useCallback(async () => {
    setIsSaving(true)
    setResult('idle')

    try {
      const success = await syncPlcWidth(innerGap, offset)

      if (success) {
        const newCurrentWidth = Math.round(innerGap)
        const newCurrentSet = Math.round(offset + railMidpoint)

        setRollers((prevRollers) =>
          prevRollers.map((r) =>
            r.id === roller.id
              ? {
                ...r,
                currentSet: newCurrentSet,
                currentWidth: newCurrentWidth
              }
              : r
          )
        )

        const setReg = ROLLER_CURRENT_SET_REGISTERS[roller.id]
        const widthReg = ROLLER_CURRENT_WIDTH_REGISTERS[roller.id]
        await writePlcRegister(setReg, newCurrentSet)
        await writePlcRegister(widthReg, newCurrentWidth)

        setResult('success')
        trigger('set', 500)
        setTimeout(() => setResult('idle'), 3000)
      } else {
        setResult('failed')
        setTimeout(() => setResult('idle'), 3000)
      }
    } catch (error) {
      console.error('Error setting width:', error)
      setResult('failed')
      setTimeout(() => setResult('idle'), 3000)
    } finally {
      setIsSaving(false)
    }
  }, [innerGap, offset, syncPlcWidth, trigger, roller.id, setRollers, railMidpoint])

  // Percentages for rendering
  const leftPlateOuterPct = mmToPct(leftPlateOuter)
  const leftPlateInnerPct = mmToPct(leftPlateInnerMM)
  const rightPlateInnerPct = mmToPct(rightPlateInnerMM)
  const gapCenterPct = mmToPct(gapCenterMM)
  const innerGapPct = mmToPct(innerGap)
  const plateWidthPct = mmToPct(PLATE_WIDTH_MM)

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="mt-4 pt-4 border-t border-slate-200/60">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-semibold">
              Width Control GUI — {roller.id}
            </div>
            <h3 className="mt-2 text-lg font-bold text-slate-900">
              {roller.name} Width Control
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Current Set: {Math.round(roller.currentSet)}mm | Current Width: {Math.round(roller.currentWidth)}mm
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {/* ── STEP SIZE CONTROLS ── */}
        <div className="grid grid-cols-2 gap-4 max-w-md mb-6">
          <div className="rounded-xl border border-slate-200/80 bg-white/60 px-4 py-3">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Expand/Compress Step (mm)
            </label>
            <input
              type="number"
              value={expandCompressStep}
              onChange={(e) => setExpandCompressStep(Number(e.target.value) || 10)}
              className="w-full bg-transparent font-mono text-lg font-bold text-slate-800 outline-none"
              min="1"
              max="200"
            />
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/60 px-4 py-3">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Move Step (mm)
            </label>
            <input
              type="number"
              value={moveStep}
              onChange={(e) => setMoveStep(Number(e.target.value) || 10)}
              className="w-full bg-transparent font-mono text-lg font-bold text-slate-800 outline-none"
              min="1"
              max="200"
            />
          </div>
        </div>

        {/* ── METRICS ROW ── */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-6">
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
                <AnimatedValue value={m.value} decimals={m.decimals} unit={m.unit} />
              </p>
            </motion.div>
          ))}
        </div>

        {/* ── VISUALIZATION ── */}
        <div className="rounded-[2rem] border border-slate-200/80 bg-slate-100/50 p-4 md:p-6 mb-6">
          <div className="relative h-[280px] overflow-hidden rounded-[1.5rem] border border-slate-300/60 bg-white">
            <div className="absolute inset-x-4 top-2 flex justify-between text-[10px] font-mono font-bold text-slate-400">
              <span>0 mm</span>
              <span className="text-cyan-600">{railMidpoint} mm (CENTER)</span>
              <span>{RAIL_LENGTH_MM} mm</span>
            </div>

            <div className="absolute inset-x-10 top-10 h-4 rounded-full bg-slate-300/50 shadow-inner" />
            <div className="absolute inset-x-10 bottom-10 h-4 rounded-full bg-slate-300/50 shadow-inner" />

            <div className="absolute top-8 bottom-8 w-px bg-cyan-500/20" style={{ left: `${mmToPct(railMidpoint)}%` }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-[9px] font-mono font-bold text-cyan-500/60 bg-white/80 px-1 rounded">
                CENTER
              </div>
            </div>

            <AnimatePresence>
              {Math.abs(offset) > 0.5 && (
                <motion.div
                  className="absolute top-6 bottom-6 w-0.5 bg-amber-500/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, left: `${gapCenterPct}%` }}
                  exit={{ opacity: 0 }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-[9px] font-mono font-bold text-amber-600 bg-amber-50/80 px-1.5 py-0.5 rounded-full border border-amber-200">
                    {offset > 0 ? '+' : ''}{Math.round(offset)}mm
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute inset-y-16 inset-x-10">
              <motion.div
                className="absolute top-1/2 h-24 -translate-y-1/2 rounded-full bg-cyan-500/20 border-2 border-cyan-500/30 overflow-hidden"
                animate={{ left: `${leftPlateInnerPct}%`, width: `${innerGapPct}%` }}
                transition={{ type: 'spring', stiffness: 70, damping: 16 }}
              >
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_6px,rgba(6,182,212,0.06)_6px,rgba(6,182,212,0.06)_8px)]" />
                <div className="absolute inset-0 flex items-center justify-center px-2">
                  <span className="text-sm font-black text-cyan-700/70 font-mono bg-white/90 px-3 py-1 rounded-full backdrop-blur-sm border border-cyan-200/50 shadow-sm">
                    <AnimatedValue value={Math.round(innerGap)} unit="mm" />
                  </span>
                </div>
              </motion.div>

              <motion.div
                className={`absolute top-1/2 h-24 -translate-y-1/2 rounded-r-xl border-2 flex items-center justify-center z-10 ${isAtLeftRail ? 'bg-red-500/30 border-red-600 shadow-[0_0_24px_rgba(239,68,68,0.3)]' : 'bg-slate-800 border-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.15)]'
                  }`}
                style={{ width: `${plateWidthPct}%` }}
                animate={{ left: `${leftPlateOuterPct}%` }}
                transition={{ type: 'spring', stiffness: 70, damping: 16 }}
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

              <motion.div
                className={`absolute top-1/2 h-24 -translate-y-1/2 rounded-l-xl border-2 flex items-center justify-center z-10 ${isAtRightRail ? 'bg-red-500/30 border-red-600 shadow-[0_0_24px_rgba(239,68,68,0.3)]' : 'bg-slate-800 border-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.15)]'
                  }`}
                style={{ width: `${plateWidthPct}%` }}
                animate={{ left: `${rightPlateInnerPct}%` }}
                transition={{ type: 'spring', stiffness: 70, damping: 16 }}
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

            <div className="absolute inset-x-10 bottom-3 flex justify-between items-end">
              {Array.from({ length: 13 }, (_, i) => {
                const mm = Math.round((i / 12) * RAIL_LENGTH_MM)
                const isMajor = i % 3 === 0
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div className={`w-px bg-slate-400/50 ${isMajor ? 'h-3' : 'h-1.5'}`} />
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

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 mb-4">
          <button
            onClick={handleMoveLeft}
            disabled={isAtLeftRail}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold text-sm transition-all ${activeAction === 'moveLeft'
                ? 'bg-cyan-600 text-white scale-95'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}>
            <ArrowLeftToLine className="w-5 h-5" />
            <span className="hidden sm:inline">Move Left</span>
            <span className="sm:hidden">Left</span>
          </button>

          <button
            onClick={handleCompress}
            disabled={isAtMinGap}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold text-sm transition-all ${activeAction === 'contract'
                ? 'bg-cyan-600 text-white scale-95'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}>
            <ChevronsRightLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Contract</span>
            <span className="sm:hidden">In</span>
          </button>

          <button
            onClick={handleExpand}
            disabled={isFullyExpanded}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold text-sm transition-all ${activeAction === 'expand'
                ? 'bg-cyan-600 text-white scale-95'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}>
            <span className="hidden sm:inline">Expand</span>
            <span className="sm:hidden">Out</span>
            <ChevronsLeftRight className="w-5 h-5" />
          </button>

          <button
            onClick={handleMoveRight}
            disabled={isAtRightRail}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold text-sm transition-all ${activeAction === 'moveRight'
                ? 'bg-cyan-600 text-white scale-95'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}>
            <span className="hidden sm:inline">Move Right</span>
            <span className="sm:hidden">Right</span>
            <ArrowRightToLine className="w-5 h-5" />
          </button>

          <button
            onClick={handleReset}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold text-sm transition-all ${activeAction === 'reset'
                ? 'bg-cyan-600 text-white scale-95'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}>
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-end">
            <button
              onClick={handleSet}
              disabled={isSaving}
              className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition ${isSaving
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-cyan-600 text-white hover:bg-cyan-700 shadow-md'
                }`}
            >
              {isSaving ? 'Setting to PLC...' : `Set Width to ${roller.id}`}
            </button>
          </div>

          {result !== 'idle' && (
            <div className={`rounded-xl px-4 py-3 text-sm ${result === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
              {result === 'success'
                ? `Width values written to ${roller.id} and PLC successfully.`
                : 'Failed to write to PLC. Please check connection and retry.'}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${plcConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-slate-600 font-medium">
                {plcConnected ? 'PLC connected' : 'PLC offline'}
              </span>
            </div>

            <div className="h-3 w-px bg-slate-300 hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isAtLeftRail || isAtRightRail || isAtMaxGap || isAtMinGap
                  ? 'bg-red-500 animate-pulse'
                  : 'bg-emerald-500'
                }`} />
              <span className="text-slate-600 font-medium">
                {isAtLeftRail || isAtRightRail || isAtMaxGap || isAtMinGap
                  ? 'AT LIMIT — Cannot move further'
                  : 'Within limits'}
              </span>
            </div>

            <div className="h-3 w-px bg-slate-300 hidden sm:block" />

            <span className="text-slate-500 font-mono">
              Rail: {RAIL_LENGTH_MM}mm | Plate: {PLATE_WIDTH_MM}mm
            </span>

            <span className="text-slate-500 font-mono">
              Min Gap: {MIN_GAP_MM}mm | Max Gap: {MAX_GAP_MM}mm
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const WidthControlSection: React.FC = () => {
  // Initialize from localStorage or use defaults
  const [rollers, setRollers] = useState<RollerControl[]>(() => {
    try {
      const saved = localStorage.getItem('rollerConfig')
      if (saved) {
        const parsedRollers = JSON.parse(saved) as RollerControl[]
        return parsedRollers
      }
    } catch (error) {
      console.error('Failed to load roller config from localStorage:', error)
    }
    return DEFAULT_ROLLERS
  })
  
  const [selectedRollerId, setSelectedRollerId] = useState(DEFAULT_ROLLERS[0].id)
  const [settingsOpenId, setSettingsOpenId] = useState<string | null>(null)
  const [plcConnected, setPlcConnected] = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [editingRoller, setEditingRoller] = useState<string | null>(null)

  const selectedRoller = rollers.find((roller) => roller.id === selectedRollerId) ?? rollers[0]

  // Persist roller config to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('rollerConfig', JSON.stringify(rollers))
    } catch (error) {
      console.error('Failed to save roller config to localStorage:', error)
    }
  }, [rollers])

  const trigger = useCallback((action: string, dur = 300) => {
    setActiveAction(action)
    setTimeout(() => setActiveAction(null), dur)
  }, [])

  const refreshRollers = useCallback(async () => {
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)

      const plcRollers = await Promise.race([
        getPlcRollers(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PLC timeout')), 3000))
      ]) as typeof getPlcRollers

      clearTimeout(timeoutId)

      if (!Array.isArray(plcRollers) || plcRollers.length === 0) {
        setPlcConnected(false)
        return
      }
      setPlcConnected(true)
      setRollers((current) =>
        current.map((roller) => {
          const updated = plcRollers.find((item) => item.id === roller.id)
          return updated
            ? { ...roller, speed: updated.speed, load: updated.load, status: updated.status }
            : roller
        })
      )
    } catch (error) {
      console.error('PLC refresh error:', error)
      setPlcConnected(false)
    }
  }, [])

  const handleUpdateRollerField = useCallback(async (rollerId: string, field: 'currentSet' | 'currentWidth', value: number) => {
    const roller = rollers.find(r => r.id === rollerId)
    if (!roller) return

    // Update local state immediately for responsiveness
    setRollers((prev) =>
      prev.map((r) =>
        r.id === rollerId ? { ...r, [field]: value } : r
      )
    )

    // Write to PLC in background without blocking
    if (field === 'currentSet') {
      const setReg = ROLLER_CURRENT_SET_REGISTERS[rollerId]
      writePlcRegister(setReg, Math.round(value)).catch((error) => {
        console.error(`Failed to update ${field} for ${rollerId}:`, error)
      })
    } else {
      const widthReg = ROLLER_CURRENT_WIDTH_REGISTERS[rollerId]
      writePlcRegister(widthReg, Math.round(value)).catch((error) => {
        console.error(`Failed to update ${field} for ${rollerId}:`, error)
      })
    }
    trigger('set', 500)
  }, [rollers, trigger])

  const handleSelectRoller = useCallback((id: string) => {
    setSelectedRollerId(id)
    setSettingsOpenId(id)
  }, [])

  const handleToggleSettings = useCallback((id: string) => {
    setSettingsOpenId((current) => (current === id ? null : id))
    setSelectedRollerId(id)
  }, [])

  // Defer PLC refresh to after initial render for faster perceived load time
  useEffect(() => {
    let active = true
    
    // Start polling after 500ms delay to let UI render first
    const initialDelay = setTimeout(() => {
      if (!active) return
      refreshRollers()
      const interval = setInterval(() => {
        if (active) refreshRollers()
      }, 2000)
      return () => clearInterval(interval)
    }, 500)

    return () => {
      active = false
      clearTimeout(initialDelay)
    }
  }, [refreshRollers])

  return (
    <section className="w-full">
      <SectionTitle title="Roller Control System" subtitle="Monitor roller status and control width" />

      <GlowingCard className="p-6 md:p-8" active={activeAction !== null} pulse={activeAction !== null}>
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="label-industrial">Individual roller monitoring</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-800">
                Monitor and control each roller independently
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
                Select a roller to adjust its width control settings. Each roller can have its own
                independent width configuration. Click on any value to edit it directly.
              </p>
              <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold ${plcConnected
                  ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200'
                  : 'bg-red-500/10 text-red-700 border border-red-200'
                }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${plcConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {plcConnected ? 'PLC sync active' : 'PLC offline'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            {rollers.map((roller) => {
              const active = roller.id === selectedRollerId
              return (
                <div
                  key={roller.id}
                  className={`rounded-[2rem] border p-5 text-left transition-shadow duration-200 ${active
                      ? 'border-cyan-400 bg-cyan-50 shadow-[0_16px_40px_rgba(6,182,212,0.08)]'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 tracking-[0.15em] uppercase">
                        {roller.id}
                      </h4>
                      <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-500">
                        {roller.name}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${roller.status === 'ok'
                        ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200'
                        : roller.status === 'warning'
                          ? 'bg-amber-500/10 text-amber-700 border border-amber-200'
                          : 'bg-red-500/10 text-red-700 border border-red-200'
                      }`}>
                      {roller.status}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Current Set (mm)</div>
                      <EditableField
                        value={roller.currentSet}
                        onSave={(newValue) => handleUpdateRollerField(roller.id, 'currentSet', newValue)}
                        unit="mm"
                        label="Current Set"
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Current Width (mm)</div>
                      <EditableField
                        value={roller.currentWidth}
                        onSave={(newValue) => handleUpdateRollerField(roller.id, 'currentWidth', newValue)}
                        unit="mm"
                        label="Current Width"
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Speed</div>
                      <div className="mt-2 text-xl font-bold text-slate-900">{roller.speed} <span className="text-sm text-slate-500">RPM</span></div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Load</div>
                      <div className="mt-2 text-xl font-bold text-slate-900">{roller.load}%</div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <button
                      onClick={() => handleToggleSettings(roller.id)}
                      className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition ${active
                          ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                      <Settings className="w-4 h-4" />
                      Configure Width for {roller.id}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <AnimatePresence>
            {settingsOpenId && selectedRoller && (
              <PlateControlGUI
                roller={selectedRoller}
                rollers={rollers}
                setRollers={setRollers}
                isOpen={true}
                onClose={() => setSettingsOpenId(null)}
              />
            )}
          </AnimatePresence>
        </div>
      </GlowingCard>
    </section>
  )
}