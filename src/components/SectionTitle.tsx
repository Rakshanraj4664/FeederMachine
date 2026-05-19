import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ title, subtitle, className }) => {
  return (
    <div className={cn('flex flex-col mb-5', className)}>
      <h2 className="text-lg md:text-xl font-bold uppercase tracking-[0.15em] text-slate-800 flex items-center gap-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
        </span>
        <span className="text-slate-800">{title}</span>
      </h2>
      {subtitle && (
        <p className="text-slate-500 text-[11px] mt-1.5 ml-10 uppercase tracking-[0.18em] font-medium">
          {subtitle}
        </p>
      )}
    </div>
  );
};