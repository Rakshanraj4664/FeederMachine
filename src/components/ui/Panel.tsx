import type { ReactNode } from 'react'
import clsx from 'clsx'

interface PanelProps {
  children: ReactNode
  className?: string
  strong?: boolean
}

export default function Panel({ children, className = '', strong = false }: PanelProps) {
  return (
    <div className={clsx(strong ? 'glass-panel-strong' : 'glass-panel', 'p-5 sm:p-6 md:p-8', className)}>
      {children}
    </div>
  )
}