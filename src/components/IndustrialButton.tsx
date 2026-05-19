import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface IndustrialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  active?: boolean;
}

export const IndustrialButton: React.FC<IndustrialButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  active = false,
  ...props
}) => {
  const baseStyles = 'relative flex items-center justify-center font-semibold transition-all duration-200 overflow-hidden rounded-xl';

  const variants = {
    primary: 'bg-slate-900 text-white border border-slate-800 hover:bg-slate-800 shadow-[0_4px_14px_rgba(15,23,42,0.15),_inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.2),_inset_0_1px_0_rgba(255,255,255,0.1)]',
    secondary: 'bg-white text-slate-800 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]',
    danger: 'bg-red-500 text-white border border-red-600 hover:bg-red-600 shadow-[0_4px_14px_rgba(239,68,68,0.2)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.25)]',
    outline: 'bg-white/70 text-slate-800 border border-slate-300 hover:bg-white hover:border-cyan-400 hover:text-cyan-700 shadow-sm',
    ghost: 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/80',
    accent: 'bg-cyan-600 text-white border border-cyan-500 hover:bg-cyan-500 shadow-[0_4px_14px_rgba(6,182,212,0.25),_inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_6px_20px_rgba(6,182,212,0.35),_inset_0_1px_0_rgba(255,255,255,0.2)]',
  };

  const sizes = {
    sm: 'text-xs px-4 py-2',
    md: 'text-sm px-5 py-2.5',
    lg: 'text-base px-6 py-3.5',
    xl: 'text-lg px-10 py-5 uppercase tracking-wider font-bold',
  };

  const activeStyles = active 
    ? 'bg-slate-800 border-cyan-400 shadow-[0_0_0_1px_rgba(6,182,212,0.3),_0_4px_14px_rgba(15,23,42,0.15)]' 
    : '';

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={cn(baseStyles, variants[variant], sizes[size], activeStyles, className)}
      {...(props as any)}
    >
      {/* Top shine */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

      {/* Bottom depth */}
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-black/5 to-transparent pointer-events-none" />

      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
};