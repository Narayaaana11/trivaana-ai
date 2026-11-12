import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Magic UI: BorderBeam (MIT) ─────────────────────────────────────────── */
interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

export const BorderBeam: React.FC<BorderBeamProps> = ({
  className,
  size = 200,
  duration = 12,
  borderWidth = 1.5,
  colorFrom = '#ff5500',
  colorTo = '#fbbf24',
  delay = 0,
}) => {
  return (
    <div
      aria-hidden="true"
      style={
        {
          '--size': size,
          '--duration': duration,
          '--border-width': borderWidth,
          '--color-from': colorFrom,
          '--color-to': colorTo,
          '--delay': `-${delay}s`,
        } as React.CSSProperties
      }
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]',
        '![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]',
        'after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-border-beam after:[animation-delay:var(--delay)]',
        'after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:90%_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]',
        className
      )}
    />
  );
};

/* ── Magic UI: BentoGrid & BentoCard (MIT) ──────────────────────────────── */
export const BentoGrid: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'grid w-full auto-rows-[minmax(14rem,auto)] grid-cols-1 md:grid-cols-3 gap-4',
      className
    )}
  >
    {children}
  </div>
);

interface BentoCardProps {
  name: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  background?: React.ReactNode;
  className?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export const BentoCard: React.FC<BentoCardProps> = ({
  name,
  description,
  Icon,
  badge,
  background,
  className,
  ctaLabel,
  onCtaClick,
}) => (
  <div
    className={cn(
      'group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-white border border-[#e4e4e9] p-6 shadow-2xs transition-all duration-300 hover:border-[#d4d4dc] hover:shadow-lg',
      className
    )}
  >
    {background && (
      <div className="pointer-events-none relative mb-4 overflow-hidden rounded-2xl border border-[#e4e4e9]/80 bg-[#fcfcfd]">
        {background}
      </div>
    )}
    <div className="relative z-10 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="w-9 h-9 rounded-xl bg-[#fff7ed] border border-[#fed7aa] text-[#ff5500] flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5" />
        </div>
        {badge && (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f6f6f8] text-[#525260] border border-[#e4e4e9]">
            {badge}
          </span>
        )}
      </div>
      <h3 className="font-display text-base sm:text-lg font-extrabold text-[#0f0f14] tracking-tight mt-1">
        {name}
      </h3>
      <p className="text-xs sm:text-[13px] text-[#525260] leading-relaxed">{description}</p>
      {ctaLabel && onCtaClick && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onCtaClick}
            className="text-xs font-bold text-[#ff5500] hover:text-[#ea580c] inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>{ctaLabel}</span>
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </button>
        </div>
      )}
    </div>
  </div>
);

/* ── Magic UI: Marquee (MIT) ────────────────────────────────────────────── */
interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  reverse?: boolean;
  pauseOnHover?: boolean;
  repeat?: number;
}

export const Marquee: React.FC<MarqueeProps> = ({
  className,
  reverse = false,
  pauseOnHover = true,
  repeat = 2,
  children,
  ...props
}) => {
  return (
    <div
      {...props}
      className={cn(
        'group flex overflow-hidden p-2 [--duration:36s] [--gap:1rem] [gap:var(--gap)]',
        className
      )}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex shrink-0 justify-around [gap:var(--gap)] flex-row',
            reverse ? 'animate-marquee-x-reverse' : 'animate-marquee-x',
            pauseOnHover && 'group-hover:paused'
          )}
        >
          {children}
        </div>
      ))}
    </div>
  );
};

/* ── Magic UI: NumberTicker (MIT) ───────────────────────────────────────── */
interface NumberTickerProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export const NumberTicker: React.FC<NumberTickerProps> = ({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let frame = 0;
    const totalFrames = 32;
    const startVal = 0;
    const timer = setInterval(() => {
      frame += 1;
      const progress = Math.min(1, frame / totalFrames);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(startVal + (value - startVal) * eased);
      if (frame >= totalFrames) clearInterval(timer);
    }, 18);
    return () => clearInterval(timer);
  }, [isInView, value]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('en-IN');

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

