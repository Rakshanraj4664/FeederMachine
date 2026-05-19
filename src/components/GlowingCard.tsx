import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GlowingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  pulse?: boolean;
  strong?: boolean;
}

export const GlowingCard: React.FC<GlowingCardProps> = ({ 
  children, 
  className, 
  active = false,
  pulse = false,
  strong = false,
  ...props 
}) => {
  return (
    <motion.div
      className={cn(
        'relative overflow-hidden transition-all duration-300',
        strong ? 'glass-panel-strong' : 'glass-panel',
        active ? 'glass-panel-active' : '',
        className
      )}
      whileHover={{ 
        y: -2, 
        boxShadow: '0 20px 48px -8px rgba(0,0,0,0.12), 0 0 30px rgba(6,182,212,0.08)' 
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      {...(props as any)}
    >
      {pulse && active && (
        <div className="absolute inset-0 bg-cyan-500/5 animate-pulse pointer-events-none z-[3]" />
      )}

      {/* Active glow ring */}
      {active && (
        <div className="absolute inset-0 rounded-[1.5rem] ring-1 ring-cyan-400/30 pointer-events-none z-[3]" />
      )}

      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </motion.div>
  );
};