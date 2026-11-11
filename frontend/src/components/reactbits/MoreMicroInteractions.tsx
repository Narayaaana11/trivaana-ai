import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

interface SloshGaugeProps {
  percentage: number;
  label?: string;
  className?: string;
}

export const SloshGauge: React.FC<SloshGaugeProps> = ({
  percentage,
  label,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex justify-between text-[11px] font-semibold">
          <span>{label}</span>
          <span className="tabular-nums">{clamped}%</span>
        </div>
      )}
      <div className="relative h-2.5 w-full rounded-full bg-[#e4e4e9] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          className="h-full rounded-full bg-gradient-to-r from-[#ff5500] via-[#fb923c] to-[#f59e0b]"
        />
      </div>
    </div>
  );
};

interface RubberSegmentProps {
  items: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
  layoutId?: string;
  className?: string;
}

export const RubberSegment: React.FC<RubberSegmentProps> = ({
  items,
  activeId,
  onChange,
  layoutId = 'rbRubberSeg',
  className = '',
}) => (
  <div className={`inline-flex flex-wrap gap-1 p-1 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9] ${className}`}>
    {items.map((it) => {
      const active = it.id === activeId;
      return (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            active ? 'text-[#0f0f14]' : 'text-[#525260] hover:text-[#0f0f14]'
          }`}
        >
          {active && (
            <motion.span
              layoutId={layoutId}
              transition={{ type: 'spring', stiffness: 520, damping: 28 }}
              className="absolute inset-0 rounded-lg bg-white border border-[#e4e4e9] shadow-2xs"
            />
          )}
          <span className="relative z-10">{it.label}</span>
        </button>
      );
    })}
  </div>
);

interface SpringCheckProps {
  checked: boolean;
  label?: string;
  onClick?: () => void;
  className?: string;
}

export const SpringCheck: React.FC<SpringCheckProps> = ({
  checked,
  label,
  onClick,
  className = '',
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 text-xs text-left cursor-pointer ${className}`}
  >
    <motion.span
      animate={{ scale: checked ? [0.8, 1.15, 1] : 1 }}
      transition={{ duration: 0.28 }}
      className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 ${
        checked
          ? 'bg-emerald-600 border-emerald-600 text-white'
          : 'bg-white border-[#d4d4dc] text-transparent'
      }`}
    >
      <Check className="w-2.5 h-2.5 stroke-[3]" />
    </motion.span>
    {label && <span className={checked ? 'line-through text-[#8a8a98]' : 'font-medium text-[#0f0f14]'}>{label}</span>}
  </button>
);

export const LatticeLoader: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`inline-grid grid-cols-3 gap-1 ${className}`} aria-label="Loading">
    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <motion.span
        key={i}
        animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.1, 0.85] }}
        transition={{ duration: 1, repeat: Infinity, delay: (i % 3) * 0.14 }}
        className="w-1.5 h-1.5 rounded-full bg-[#ff5500]"
      />
    ))}
  </div>
);

interface ThoughtLineProps {
  steps: { title: string; subtitle: string; done?: boolean }[];
}

export const ThoughtLine: React.FC<ThoughtLineProps> = ({ steps }) => (
  <div className="space-y-3 pl-3 border-l-2 border-[#e4e4e9]">
    {steps.map((s, idx) => (
      <div key={idx} className="relative pl-3">
        <span
          className={`absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${
            s.done ? 'bg-emerald-500' : 'bg-[#ff5500]'
          }`}
        />
        <div className="text-xs font-bold text-[#0f0f14]">{s.title}</div>
        <div className="text-[11px] text-[#6e6e7e]">{s.subtitle}</div>
      </div>
    ))}
  </div>
);

interface HoldButtonProps {
  label: string;
  holdingLabel?: string;
  holdDurationMs?: number;
  onConfirm: () => void;
  className?: string;
}

export const HoldButton: React.FC<HoldButtonProps> = ({
  label,
  holdingLabel = 'Hold to confirm...',
  holdDurationMs = 900,
  onConfirm,
  className = '',
}) => {
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    if (!holding) return;
    const id = window.setTimeout(() => {
      setHolding(false);
      onConfirm();
    }, holdDurationMs);
    return () => window.clearTimeout(id);
  }, [holding, holdDurationMs, onConfirm]);

  return (
    <button
      type="button"
      onPointerDown={() => setHolding(true)}
      onPointerUp={() => setHolding(false)}
      onPointerLeave={() => setHolding(false)}
      className={`relative overflow-hidden px-4 py-2 rounded-xl border font-bold text-xs cursor-pointer select-none ${className}`}
    >
      {holding && (
        <motion.span
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: holdDurationMs / 1000, ease: 'linear' }}
          className="absolute inset-y-0 left-0 bg-red-600/20"
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {holding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {holding ? holdingLabel : label}
      </span>
    </button>
  );
};

interface PromptBarProps {
  children: React.ReactNode;
  focused?: boolean;
  className?: string;
}

export const PromptBar: React.FC<PromptBarProps> = ({
  children,
  focused = false,
  className = '',
}) => (
  <div
    className={`rounded-2xl border transition-all duration-200 ${
      focused
        ? 'border-[#ff5500]/70 ring-4 ring-[#ff5500]/15'
        : 'border-white/12 hover:border-white/25'
    } ${className}`}
  >
    {children}
  </div>
);

interface SwipeToastProps {
  type: 'success' | 'error';
  message: string;
}

export const SwipeToast: React.FC<SwipeToastProps> = ({ type, message }) => (
  <motion.div
    initial={{ opacity: 0, x: 16 }}
    animate={{ opacity: 1, x: 0 }}
    className={`p-3.5 rounded-2xl border text-xs font-medium ${
      type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-red-50 border-red-200 text-red-800'
    }`}
  >
    {message}
  </motion.div>
);

