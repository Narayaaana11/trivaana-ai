import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface CircularTextProps {
  text: string;
  size?: number;
  className?: string;
}

export const CircularText: React.FC<CircularTextProps> = ({
  text,
  size = 96,
  className = '',
}) => {
  const chars = text.split('');
  const step = 360 / Math.max(chars.length, 1);

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full flex items-center justify-center animate-rb-star-orbit select-none ${className}`}
      aria-label={text}
    >
      {chars.map((ch, idx) => (
        <span
          key={idx}
          aria-hidden="true"
          style={{
            transform: `rotate(${idx * step}deg) translateY(-${size / 2 - 10}px)`,
          }}
          className="absolute text-[9px] font-bold uppercase tracking-widest"
        >
          {ch}
        </span>
      ))}
    </div>
  );
};

interface TextLoopProps {
  items: string[];
  intervalMs?: number;
  className?: string;
}

export const TextLoop: React.FC<TextLoopProps> = ({
  items,
  intervalMs = 2400,
  className = '',
}) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % items.length), intervalMs);
    return () => window.clearInterval(id);
  }, [items.length, intervalMs]);

  return (
    <span className={`inline-flex overflow-hidden align-baseline ${className}`}>
      <AnimatePresence mode="wait">
        <motion.span
          key={items[idx]}
          initial={{ y: 12, opacity: 0, filter: 'blur(3px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: -12, opacity: 0, filter: 'blur(3px)' }}
          transition={{ duration: 0.28 }}
          className="inline-block"
        >
          {items[idx]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

interface SplitFlapTextProps {
  text: string;
  className?: string;
}

export const SplitFlapText: React.FC<SplitFlapTextProps> = ({ text, className = '' }) => (
  <span aria-label={text} className={`inline-flex items-center gap-[2px] ${className}`}>
    {text.split('').map((ch, idx) => (
      <motion.span
        key={`${idx}-${ch}`}
        initial={{ rotateX: -75, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ duration: 0.28, delay: Math.min(idx * 0.025, 0.4) }}
        className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#121019] text-white font-mono-code font-bold text-xs border border-white/15 shadow-2xs"
      >
        {ch === ' ' ? '\u00A0' : ch}
      </motion.span>
    ))}
  </span>
);

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&';

interface ScrambledTextProps {
  text: string;
  className?: string;
}

export const ScrambledText: React.FC<ScrambledTextProps> = ({ text, className = '' }) => {
  const [rendered, setRendered] = useState(text);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!hovered) return;
    let tick = 0;
    const id = window.setInterval(() => {
      tick += 1;
      setRendered(
        text
          .split('')
          .map((c, i) => (c === ' ' || i < tick ? c : GLYPHS[(i * 7 + tick) % GLYPHS.length]))
          .join('')
      );
      if (tick >= text.length) {
        setRendered(text);
        window.clearInterval(id);
      }
    }, 24);
    return () => window.clearInterval(id);
  }, [hovered, text]);

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setRendered(text);
      }}
      className={`cursor-default ${className}`}
    >
      {hovered ? rendered : text}
    </span>
  );
};

interface ShuffleProps {
  text: string;
  className?: string;
}

export const Shuffle: React.FC<ShuffleProps> = ({ text, className = '' }) => (
  <motion.span
    initial={{ opacity: 0, letterSpacing: '0.18em' }}
    whileInView={{ opacity: 1, letterSpacing: 'normal' }}
    viewport={{ once: true, amount: 'some' }}
    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    className={`inline-block ${className}`}
  >
    {text}
  </motion.span>
);

interface FuzzyTextProps {
  children: React.ReactNode;
  intensity?: number;
  className?: string;
}

export const FuzzyText: React.FC<FuzzyTextProps> = ({
  children,
  intensity = 0.6,
  className = '',
}) => (
  <span
    style={{
      textShadow: `${intensity}px 0 0 rgba(255, 85, 0, 0.45), -${intensity}px 0 0 rgba(59, 130, 246, 0.35)`,
    }}
    className={`inline-block ${className}`}
  >
    {children}
  </span>
);

interface ScrollRevealProps {
  text: string;
  className?: string;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({ text, className = '' }) => (
  <span aria-label={text} className={`inline-flex flex-wrap gap-x-[0.26em] ${className}`}>
    {text.split(' ').map((word, idx) => (
      <motion.span
        key={`${word}-${idx}`}
        aria-hidden="true"
        initial={{ opacity: 0.25, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 'some' }}
        transition={{ duration: 0.35, delay: Math.min(idx * 0.03, 0.3) }}
      >
        {word}
      </motion.span>
    ))}
  </span>
);

