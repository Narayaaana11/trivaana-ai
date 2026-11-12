import React from 'react';
import { cn } from '@/lib/utils';

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input
    data-slot="input"
    className={cn(
      'w-full h-9 px-3.5 rounded-xl bg-white border border-[#e4e4e9] text-xs text-[#0f0f14] placeholder:text-[#8a8a98] transition-colors focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/15 disabled:opacity-50',
      className
    )}
    {...props}
  />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...props }) => (
  <textarea
    data-slot="textarea"
    className={cn(
      'w-full p-3.5 rounded-xl bg-white border border-[#e4e4e9] text-xs text-[#0f0f14] placeholder:text-[#8a8a98] transition-colors focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/15 disabled:opacity-50 resize-y',
      className
    )}
    {...props}
  />
);

