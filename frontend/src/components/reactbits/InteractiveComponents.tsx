import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface BorderGlowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glowColor?: string;
  className?: string;
}

export const BorderGlow: React.FC<BorderGlowProps> = ({
  children,
  glowColor = 'rgba(255, 85, 0, 0.35)',
  className = '',
  ...props
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0, active: false });

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top, active: true });
      }}
      onMouseLeave={() => setCoords((c) => ({ ...c, active: false }))}
      className={`relative rounded-2xl p-[1px] overflow-hidden bg-[#e4e4e9] transition-colors ${className}`}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: coords.active ? 1 : 0,
          background: `radial-gradient(280px circle at ${coords.x}px ${coords.y}px, ${glowColor}, transparent 70%)`,
        }}
      />
      <div className="relative z-10 h-full w-full rounded-[15px] bg-white">
        {children}
      </div>
    </div>
  );
};

interface TiltedCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}

export const TiltedCard: React.FC<TiltedCardProps> = ({
  children,
  className = '',
  maxTilt = 4,
}) => {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  return (
    <div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
        const py = (e.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
        setTilt({ rx: -py * maxTilt * 2, ry: px * maxTilt * 2 });
      }}
      onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
      style={{
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className={className}
    >
      {children}
    </div>
  );
};

interface AnimatedListProps {
  children: React.ReactNode[];
  className?: string;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({ children, className = '' }) => (
  <div className={className}>
    {React.Children.map(children, (child, idx) => (
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.24) }}
      >
        {child}
      </motion.div>
    ))}
  </div>
);

interface StepperProps {
  steps: { label: string }[];
  currentStep: number;
  onStepClick?: (index: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep, onStepClick }) => (
  <div className="flex items-center gap-1.5 w-full">
    {steps.map((st, idx) => {
      const done = idx < currentStep;
      const active = idx === currentStep;
      return (
        <React.Fragment key={st.label}>
          <button
            type="button"
            onClick={() => onStepClick?.(idx)}
            title={st.label}
            className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              active
                ? 'bg-[#ff5500] text-white shadow-xs'
                : done
                ? 'bg-emerald-600 text-white'
                : 'bg-[#f6f6f8] border border-[#e4e4e9] text-[#8a8a98]'
            }`}
          >
            {idx + 1}
          </button>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-0.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-[#e4e4e9]'}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

interface GlassIconProps {
  icon: LucideIcon;
  accent?: 'orange' | 'emerald' | 'indigo' | 'amber';
  className?: string;
}

const ACCENT_CLASSES: Record<NonNullable<GlassIconProps['accent']>, string> = {
  orange: 'from-[#ff5500]/20 to-[#fb923c]/10 border-[#fed7aa] text-[#ff5500]',
  emerald: 'from-emerald-500/20 to-teal-500/10 border-emerald-200 text-emerald-700',
  indigo: 'from-indigo-500/20 to-violet-500/10 border-indigo-200 text-indigo-700',
  amber: 'from-amber-500/20 to-orange-500/10 border-amber-200 text-amber-700',
};

export const GlassIcons: React.FC<GlassIconProps> = ({
  icon: Icon,
  accent = 'orange',
  className = '',
}) => (
  <div
    className={`w-10 h-10 rounded-xl bg-gradient-to-br border backdrop-blur-xs flex items-center justify-center shadow-2xs shrink-0 ${ACCENT_CLASSES[accent]} ${className}`}
  >
    <Icon className="w-4 h-4" />
  </div>
);

interface PillNavItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface PillNavProps {
  items: PillNavItem[];
  activeId: string;
  onChange: (id: string) => void;
  layoutGroupId: string;
  className?: string;
}

export const PillNav: React.FC<PillNavProps> = ({
  items,
  activeId,
  onChange,
  layoutGroupId,
  className = '',
}) => (
  <div className={`inline-flex p-1 rounded-2xl bg-[#f6f6f8] border border-[#e4e4e9] ${className}`}>
    {items.map((item) => {
      const Icon = item.icon;
      const isActive = item.id === activeId;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
            isActive ? 'text-[#0f0f14]' : 'text-[#525260] hover:text-[#0f0f14]'
          }`}
        >
          {isActive && (
            <motion.span
              layoutId={layoutGroupId}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="absolute inset-0 rounded-xl bg-white border border-[#e4e4e9] shadow-2xs"
            />
          )}
          <span className="relative z-10 inline-flex items-center gap-1.5">
            {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#ff5500]' : ''}`} />}
            <span>{item.label}</span>
          </span>
        </button>
      );
    })}
  </div>
);

interface DockItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface DockProps {
  items: DockItem[];
  className?: string;
}

export const Dock: React.FC<DockProps> = ({ items, className = '' }) => (
  <div
    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-white/95 backdrop-blur-md border border-[#e4e4e9] shadow-md ${className}`}
  >
    {items.map((item) => {
      const Icon = item.icon;
      return (
        <motion.button
          key={item.label}
          type="button"
          onClick={item.onClick}
          whileHover={{ scale: 1.08, y: -2 }}
          whileTap={{ scale: 0.96 }}
          className="px-2.5 py-1.5 rounded-xl bg-[#f6f6f8] hover:bg-[#fff7ed] border border-[#e4e4e9] hover:border-[#fed7aa] text-[#0f0f14] text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Icon className="w-3.5 h-3.5 text-[#ff5500]" />
          <span>{item.label}</span>
        </motion.button>
      );
    })}
  </div>
);

