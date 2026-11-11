import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface FadeContentProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const FadeContent: React.FC<FadeContentProps> = ({
  children,
  delay = 0,
  className = '',
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 'some' }}
    transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

interface AnimatedContentProps {
  children: React.ReactNode;
  direction?: 'vertical' | 'horizontal';
  distance?: number;
  delay?: number;
  className?: string;
}

export const AnimatedContent: React.FC<AnimatedContentProps> = ({
  children,
  direction = 'vertical',
  distance = 18,
  delay = 0,
  className = '',
}) => {
  const initial = direction === 'horizontal' ? { opacity: 0, x: distance } : { opacity: 0, y: distance };
  return (
    <motion.div
      initial={initial}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 'some' }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface StarBorderProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
  innerClassName?: string;
}

export const StarBorder: React.FC<StarBorderProps> = ({
  children,
  color = '#ff5500',
  className = '',
  innerClassName = '',
}) => (
  <div className={`relative inline-flex p-[1.5px] rounded-full overflow-hidden group ${className}`}>
    <span
      aria-hidden="true"
      style={{
        background: `conic-gradient(from 0deg, transparent 0%, transparent 72%, ${color} 86%, #fbbf24 94%, transparent 100%)`,
      }}
      className="absolute inset-[-100%] animate-rb-star-orbit opacity-85 pointer-events-none"
    />
    <div className={`relative z-10 w-full h-full rounded-full ${innerClassName}`}>
      {children}
    </div>
  </div>
);

interface GlareHoverProps {
  children: React.ReactNode;
  className?: string;
}

export const GlareHover: React.FC<GlareHoverProps> = ({ children, className = '' }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-[-20deg] transition-transform duration-700 ${
          hovered ? 'translate-x-[150%]' : ''
        }`}
      />
    </div>
  );
};

interface SparkParticle {
  id: number;
  x: number;
  y: number;
}

interface ClickSparkProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export const ClickSpark: React.FC<ClickSparkProps> = ({
  children,
  color = '#ff5500',
  className = '',
}) => {
  const [sparks, setSparks] = useState<SparkParticle[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now() + Math.random();
    setSparks((prev) => [...prev.slice(-4), { id, x, y }]);
    window.setTimeout(() => {
      setSparks((prev) => prev.filter((s) => s.id !== id));
    }, 520);
  };

  return (
    <div onClick={handleClick} className={`relative inline-flex ${className}`}>
      {children}
      {sparks.map((sp) => (
        <span
          key={sp.id}
          aria-hidden="true"
          style={{ left: sp.x, top: sp.y }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-30"
        >
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <motion.span
              key={deg}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos((deg * Math.PI) / 180) * 18,
                y: Math.sin((deg * Math.PI) / 180) * 18,
                opacity: 0,
                scale: 0.2,
              }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              style={{ backgroundColor: color }}
              className="absolute w-1.5 h-1.5 rounded-full"
            />
          ))}
        </span>
      ))}
    </div>
  );
};

interface LogoLoopItem {
  name: string;
  tag?: string;
}

interface LogoLoopProps {
  items: LogoLoopItem[];
  className?: string;
}

export const LogoLoop: React.FC<LogoLoopProps> = ({ items, className = '' }) => {
  const doubled = [...items, ...items];
  return (
    <div className={`relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] ${className}`}>
      <div className="flex w-max items-center gap-4 animate-rb-marquee">
        {doubled.map((item, idx) => (
          <div
            key={`${item.name}-${idx}`}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#e4e4e9] text-xs font-semibold text-[#0f0f14] shadow-2xs shrink-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff5500]" />
            <span>{item.name}</span>
            {item.tag && <span className="text-[10px] text-[#8a8a98] font-medium">{item.tag}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

