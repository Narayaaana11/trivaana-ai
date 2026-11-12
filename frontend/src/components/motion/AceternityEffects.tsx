import React, { useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Aceternity UI: Spotlight (Free MIT/Commercial) ─────────────────────── */
interface SpotlightProps {
  className?: string;
  fill?: string;
}

export const Spotlight: React.FC<SpotlightProps> = ({
  className,
  fill = '#ff5500',
}) => (
  <svg
    aria-hidden="true"
    className={cn(
      'pointer-events-none absolute z-[1] h-[169%] w-[138%] lg:w-[84%] opacity-25',
      className
    )}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 3787 2842"
    fill="none"
  >
    <g filter="url(#trivaana-spotlight-filter)">
      <ellipse
        cx="1924.71"
        cy="273.501"
        rx="1924.71"
        ry="273.501"
        transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
        fill={fill}
        fillOpacity="0.28"
      />
    </g>
    <defs>
      <filter
        id="trivaana-spotlight-filter"
        x="0.860352"
        y="0.838989"
        width="3785.16"
        height="2840.26"
        filterUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <feGaussianBlur stdDeviation="151" result="effect1_foregroundBlur" />
      </filter>
    </defs>
  </svg>
);

/* ── Aceternity UI: BackgroundBeams (Free) ──────────────────────────────── */
export const BackgroundBeams: React.FC<{ className?: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
  >
    <svg
      className="h-full w-full opacity-30"
      viewBox="0 0 1440 600"
      fill="none"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="trivaana-beam-1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff5500" stopOpacity="0" />
          <stop offset="50%" stopColor="#ff5500" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M-120 80 C 320 260, 720 120, 1560 360" stroke="url(#trivaana-beam-1)" strokeWidth="1.2" />
      <path d="M-80 280 C 400 120, 920 420, 1520 160" stroke="url(#trivaana-beam-1)" strokeWidth="1" />
      <path d="M-40 480 C 520 340, 1020 500, 1500 280" stroke="url(#trivaana-beam-1)" strokeWidth="0.9" />
    </svg>
  </div>
);

/* ── Aceternity UI: TracingBeam (Free) ──────────────────────────────────── */
export const TracingBeam: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 80%', 'end 60%'],
  });
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 32,
  });

  return (
    <div ref={ref} className={cn('relative pl-6 sm:pl-10', className)}>
      <div
        aria-hidden="true"
        className="absolute left-1.5 sm:left-3 top-2 bottom-2 w-0.5 bg-[#e4e4e9] rounded-full overflow-hidden"
      >
        <motion.div
          style={{ scaleY, transformOrigin: 'top' }}
          className="w-full h-full bg-gradient-to-b from-[#ff5500] via-[#fbbf24] to-[#16a34a]"
        />
      </div>
      {children}
    </div>
  );
};

