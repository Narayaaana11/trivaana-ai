import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline' | 'dark';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-[#f6f6f8] text-[#525260] border-[#e4e4e9]',
  primary: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  destructive: 'bg-red-50 text-red-700 border-red-200',
  outline: 'bg-white text-[#0f0f14] border-[#e4e4e9]',
  dark: 'bg-[#1b1824] text-white border-white/15',
};

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', ...props }) => (
  <span
    data-slot="badge"
    className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap',
      BADGE_CLASSES[variant],
      className
    )}
    {...props}
  />
);

