import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface TabOption<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface TabsProps<T extends string = string> {
  items: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId?: string;
  variant?: 'pill' | 'underline';
  className?: string;
}

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  layoutId = 'trivaana-tabs',
  variant = 'pill',
  className,
}: TabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div
        role="tablist"
        className={cn('flex items-center gap-1 border-b border-[#e4e4e9] overflow-x-auto', className)}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = value === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                'relative px-3.5 py-2.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors',
                active ? 'text-[#0f0f14]' : 'text-[#525260] hover:text-[#0f0f14]'
              )}
            >
              {Icon && <Icon className={cn('w-3.5 h-3.5', active ? 'text-[#ff5500]' : 'text-[#8a8a98]')} />}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f6f6f8] text-[#525260] border border-[#e4e4e9]">
                  {item.badge}
                </span>
              )}
              {active && (
                <motion.span
                  layoutId={layoutId}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-x-1 bottom-0 h-0.5 bg-[#ff5500] rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#f6f6f8] border border-[#e4e4e9]',
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = value === item.id;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'relative px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors',
              active ? 'text-[#0f0f14]' : 'text-[#525260] hover:text-[#0f0f14]'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-xl bg-white border border-[#e4e4e9] shadow-2xs"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {Icon && <Icon className={cn('w-3.5 h-3.5', active ? 'text-[#ff5500]' : 'text-[#8a8a98]')} />}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]">
                  {item.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

