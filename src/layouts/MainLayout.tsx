import type { ReactNode } from 'react'
import InteractiveBackground from '../components/InteractiveBackground'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen w-full relative">
      <InteractiveBackground />
      <div className="relative z-10 flex flex-col items-center p-4 sm:p-6 md:p-10 gap-8">
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 pb-24">
          {children}
        </div>
      </div>
    </div>
  )
}