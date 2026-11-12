import React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'dark';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  pill?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#ff5500] hover:bg-[#ea580c] text-white shadow-sm shadow-[#ff5500]/20 border border-transparent',
  secondary:
    'bg-[#f6f6f8] hover:bg-[#ebebf0] text-[#0f0f14] border border-[#e4e4e9]',
  outline:
    'bg-white hover:bg-[#f6f6f8] text-[#0f0f14] border border-[#e4e4e9] shadow-2xs',
  ghost:
    'bg-transparent hover:bg-[#f6f6f8] text-[#525260] hover:text-[#0f0f14] border border-transparent',
  destructive:
    'bg-red-600 hover:bg-red-700 text-white shadow-sm border border-transparent',
  dark:
    'bg-[#121019] hover:bg-[#1b1824] text-white shadow-sm border border-white/10',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-[11px] gap-1.5',
  sm: 'h-8 px-3.5 text-xs gap-1.5',
  md: 'h-9 px-4 text-xs gap-2',
  lg: 'h-11 px-6 text-xs sm:text-sm gap-2',
  icon: 'h-8 w-8 p-0 justify-center',
};

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  pill = false,
  disabled,
  children,
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        pill ? 'rounded-full' : 'rounded-xl',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
        />
      )}
      {children}
    </button>
  );
};

