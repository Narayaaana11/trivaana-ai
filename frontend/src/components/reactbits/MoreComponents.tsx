import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface CounterProps {
  value: number;
  className?: string;
}

export const Counter: React.FC<CounterProps> = ({ value, className = '' }) => (
  <AnimatePresence mode="popLayout" initial={false}>
    <motion.span
      key={value}
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 10, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={`inline-block tabular-nums ${className}`}
    >
      {value.toLocaleString('en-IN')}
    </motion.span>
  </AnimatePresence>
);

interface ElasticSliderProps {
  id?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export const ElasticSlider: React.FC<ElasticSliderProps> = ({
  id,
  min,
  max,
  step = 1,
  value,
  onChange,
  className = '',
}) => {
  const [dragging, setDragging] = useState(false);
  const pct = Math.max(0, Math.min(100, ((value - min) / Math.max(max - min, 1)) * 100));

  return (
    <div className={`relative py-2 select-none ${className}`}>
      <div
        className={`h-2.5 w-full rounded-full bg-[#e4e4e9] overflow-hidden transition-transform duration-150 ${
          dragging ? 'scale-y-125' : ''
        }`}
      >
        <div
          style={{ width: `${pct}%` }}
          className="h-full rounded-full bg-gradient-to-r from-[#ff5500] to-[#f59e0b]"
        />
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
        onBlur={() => setDragging(false)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
      />
    </div>
  );
};

interface GlassSurfaceProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({ children, className = '' }) => (
  <div
    className={`rounded-2xl bg-white/75 backdrop-blur-md border border-[#e4e4e9]/90 shadow-xs ${className}`}
  >
    {children}
  </div>
);

interface HoloCardProps {
  children: React.ReactNode;
  className?: string;
}

export const HoloCard: React.FC<HoloCardProps> = ({ children, className = '' }) => {
  const [pos, setPos] = useState({ x: 50, y: 50 });

  return (
    <div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPos({
          x: ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 100,
          y: ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 100,
        });
      }}
      style={{
        background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255, 85, 0, 0.14), rgba(251, 146, 60, 0.04) 45%, #121019 85%)`,
      }}
      className={`rounded-2xl border border-white/15 p-5 text-white transition-all ${className}`}
    >
      {children}
    </div>
  );
};

interface CardSwapItem {
  id: string;
  badge: string;
  title: string;
  meta: string;
  outcome: string;
}

interface CardSwapProps {
  cards: CardSwapItem[];
  intervalMs?: number;
  className?: string;
}

export const CardSwap: React.FC<CardSwapProps> = ({
  cards,
  intervalMs = 3400,
  className = '',
}) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (cards.length <= 1) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % cards.length), intervalMs);
    return () => window.clearInterval(id);
  }, [cards.length, intervalMs]);

  const card = cards[index] || cards[0];
  if (!card) return null;

  return (
    <div className={`relative ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.32 }}
          className="p-4 rounded-2xl bg-[#1b1824] border border-white/12 text-white shadow-lg space-y-2"
        >
          <div className="flex items-center justify-between text-[10px]">
            <span className="px-2 py-0.5 rounded-full bg-[#ff5500]/25 text-[#ff8547] font-bold uppercase">
              {card.badge}
            </span>
            <span className="text-slate-400">{card.meta}</span>
          </div>
          <div className="font-display font-bold text-sm">{card.title}</div>
          <div className="text-xs text-emerald-400 font-semibold">{card.outcome}</div>
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center justify-center gap-1.5 mt-2.5">
        {cards.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            aria-label={`Show card ${idx + 1}`}
            onClick={() => setIndex(idx)}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              idx === index ? 'w-5 bg-[#ff5500]' : 'w-1.5 bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

interface MagicBentoProps {
  children: React.ReactNode;
  className?: string;
}

export const MagicBento: React.FC<MagicBentoProps> = ({ children, className = '' }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
    {children}
  </div>
);

interface ChromaGridProps {
  children: React.ReactNode;
  className?: string;
}

export const ChromaGrid: React.FC<ChromaGridProps> = ({ children, className = '' }) => (
  <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
    {children}
  </div>
);

interface GooeyNavProps {
  items: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
  layoutId?: string;
}

export const GooeyNav: React.FC<GooeyNavProps> = ({
  items,
  activeId,
  onChange,
  layoutId = 'rbGooeyNav',
}) => (
  <div className="inline-flex flex-wrap gap-1 p-1 rounded-2xl bg-[#f6f6f8] border border-[#e4e4e9]">
    {items.map((item) => {
      const active = item.id === activeId;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`relative px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            active ? 'text-white' : 'text-[#525260] hover:text-[#0f0f14]'
          }`}
        >
          {active && (
            <motion.span
              layoutId={layoutId}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              className="absolute inset-0 rounded-xl bg-[#0f0f14] shadow-xs"
            />
          )}
          <span className="relative z-10">{item.label}</span>
        </button>
      );
    })}
  </div>
);

