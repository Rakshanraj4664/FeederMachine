import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface ControlButtonProps {
  label: string
  icon: LucideIcon
  onClick: () => void
  active?: boolean
  accent?: boolean
}

export default function ControlButton({ label, icon: Icon, onClick, active, accent }: ControlButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -2, boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08)' }}
      onClick={onClick}
      className={`
        group flex h-14 w-full items-center justify-center gap-2.5 
        rounded-2xl border text-sm font-semibold uppercase tracking-[0.15em] 
        transition-all duration-200 
        focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:ring-offset-2 focus:ring-offset-white/60
        ${accent 
          ? 'border-cyan-500/40 bg-cyan-500/5 text-cyan-700 hover:bg-cyan-500/10 hover:border-cyan-500/60 shadow-[0_2px_8px_rgba(6,182,212,0.06)]' 
          : 'border-slate-300/80 bg-white/60 text-slate-700 hover:bg-white hover:border-slate-400/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]'
        } 
        ${active 
          ? 'border-slate-800 bg-slate-800 text-white shadow-[0_4px_16px_rgba(15,23,42,0.15)]' 
          : ''
        }
      `}
    >
      <Icon className={`h-4.5 w-4.5 transition-colors ${active ? 'text-white' : accent ? 'text-cyan-600' : 'text-slate-500 group-hover:text-slate-700'}`} />
      <span>{label}</span>
    </motion.button>
  )
}