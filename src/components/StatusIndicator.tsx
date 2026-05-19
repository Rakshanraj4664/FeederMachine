import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatusIndicatorProps {
  status: 'ok' | 'warning' | 'error' | 'inactive';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  className,
  label,
}) => {
  const sizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3.5 h-3.5',
    lg: 'w-5 h-5',
  };

  const colors = {
    ok: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5),_0_0_20px_rgba(16,185,129,0.2)]',
    warning: 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4),_0_0_20px_rgba(245,158,11,0.15)] animate-pulse',
    error: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5),_0_0_20px_rgba(239,68,68,0.2)] animate-pulse',
    inactive: 'bg-slate-400 shadow-none',
  };

  const ringColors = {
    ok: 'ring-emerald-500/30',
    warning: 'ring-amber-500/30',
    error: 'ring-red-500/30',
    inactive: 'ring-slate-400/20',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'rounded-full ring-2 ring-offset-2 ring-offset-white/80',
          sizes[size],
          colors[status],
          ringColors[status],
          className
        )}
      />
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          {label}
        </span>
      )}
    </div>
  );
};