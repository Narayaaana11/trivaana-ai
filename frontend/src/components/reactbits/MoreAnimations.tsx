import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface ElectricBorderProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export const ElectricBorder: React.FC<ElectricBorderProps> = ({
  children,
  color = '#ff5500',
  className = '',
}) => (
  <div className={`relative rounded-2xl p-[1.5px] overflow-hidden ${className}`}>
    <div
      aria-hidden="true"
      style={{
        background: `conic-gradient(from 90deg, ${color}, #fbbf24, transparent 40%, ${color} 80%, #ea580c)`,
      }}
      className="pointer-events-none absolute inset-[-120%] animate-rb-star-orbit opacity-75"
    />
    <div className="relative z-10 h-full w-full rounded-[14.5px] bg-white">{children}</div>
  </div>
);

interface PixelTransitionProps {
  firstContent: React.ReactNode;
  secondContent: React.ReactNode;
  className?: string;
}

export const PixelTransition: React.FC<PixelTransitionProps> = ({
  firstContent,
  secondContent,
  className = '',
}) => {
  const [active, setActive] = useState(false);

  return (
    <div
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={`relative overflow-hidden ${className}`}
    >
      <div className={`transition-opacity duration-300 ${active ? 'opacity-0' : 'opacity-100'}`}>
        {firstContent}
      </div>
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          active ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {secondContent}
      </div>
    </div>
  );
};

interface GradualBlurProps {
  position?: 'bottom' | 'top';
  className?: string;
}

export const GradualBlur: React.FC<GradualBlurProps> = ({
  position = 'bottom',
  className = '',
}) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none sticky left-0 right-0 h-6 z-10 ${
      position === 'bottom'
        ? 'bottom-0 bg-gradient-to-t from-white/95 to-transparent'
        : 'top-0 bg-gradient-to-b from-white/95 to-transparent'
    } ${className}`}
  />
);

export const NoiseOverlay: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    aria-hidden="true"
    style={{
      backgroundImage:
        'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 0), radial-gradient(rgba(255,85,0,0.06) 1px, transparent 0)',
      backgroundSize: '18px 18px',
      backgroundPosition: '0 0, 9px 9px',
    }}
    className={`pointer-events-none absolute inset-0 opacity-45 ${className}`}
  />
);

interface SpecularButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const SpecularButton: React.FC<SpecularButtonProps> = ({
  children,
  className = '',
  ...props
}) => (
  <motion.button
    whileHover={{ y: -1 }}
    whileTap={{ scale: 0.98 }}
    className={`relative overflow-hidden group cursor-pointer ${className}`}
    {...(props as any)}
  >
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-18deg]"
    />
    <span className="relative z-10 inline-flex items-center justify-center gap-1.5">{children}</span>
  </motion.button>
);

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const RippleButton: React.FC<RippleButtonProps> = ({
  children,
  className = '',
  onClick,
  ...props
}) => {
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);

  return (
    <button
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, key: Date.now() });
        onClick?.(e);
      }}
      className={`relative overflow-hidden cursor-pointer ${className}`}
      {...props}
    >
      {ripple && (
        <motion.span
          key={ripple.key}
          initial={{ scale: 0, opacity: 0.45 }}
          animate={{ scale: 6, opacity: 0 }}
          transition={{ duration: 0.55 }}
          style={{ left: ripple.x, top: ripple.y }}
          className="pointer-events-none absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60"
        />
      )}
      <span className="relative z-10 inline-flex items-center justify-center gap-1.5">{children}</span>
    </button>
  );
};

