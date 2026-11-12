import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, interactive = false, ...props }) => (
  <div
    data-slot="card"
    className={cn(
      'rounded-2xl bg-white border border-[#e4e4e9] shadow-2xs text-[#0f0f14]',
      interactive && 'transition-all duration-200 hover:border-[#d4d4dc] hover:shadow-md',
      className
    )}
    {...props}
  />
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div data-slot="card-header" className={cn('p-5 pb-3 flex flex-col gap-1', className)} {...props} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h3 data-slot="card-title" className={cn('font-display text-sm font-bold text-[#0f0f14] tracking-tight', className)} {...props} />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p data-slot="card-description" className={cn('text-xs text-[#525260] leading-relaxed', className)} {...props} />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div data-slot="card-content" className={cn('p-5 pt-0', className)} {...props} />
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div data-slot="card-footer" className={cn('p-5 pt-3 border-t border-[#e4e4e9]/80 flex items-center justify-between gap-2', className)} {...props} />
);

