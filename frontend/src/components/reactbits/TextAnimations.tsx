import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
}

export const GradientText: React.FC<GradientTextProps> = ({
  children,
  className = '',
  colors = ['#ff5500', '#fb923c', '#f59e0b', '#ff5500'],
}) => {
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(90deg, ${colors.join(', ')})`,
      }}
      className={`inline-block bg-clip-text text-transparent animate-rb-gradient ${className}`}
    >
      {children}
    </span>
  );
};

interface RotatingTextProps {
  texts: string[];
  rotationInterval?: number;
  className?: string;
}

export const RotatingText: React.FC<RotatingTextProps> = ({
  texts,
  rotationInterval = 2600,
  className = '',
}) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (texts.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length);
    }, rotationInterval);
    return () => window.clearInterval(id);
  }, [texts.length, rotationInterval]);

  return (
    <span className={`inline-flex relative overflow-hidden align-bottom ${className}`}>
      <AnimatePresence mode="wait">
        <motion.span
          key={texts[index]}
          initial={{ y: '45%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-45%', opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block"
        >
          {texts[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

interface SplitTextProps {
  text: string;
  className?: string;
  staggerMs?: number;
}

export const SplitText: React.FC<SplitTextProps> = ({
  text,
  className = '',
  staggerMs = 35,
}) => {
  const words = text.split(' ');
  return (
    <span aria-label={text} className={`inline-flex flex-wrap gap-x-[0.28em] ${className}`}>
      {words.map((word, idx) => (
        <motion.span
          key={`${word}-${idx}`}
          aria-hidden="true"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 'some' }}
          transition={{ duration: 0.4, delay: (idx * staggerMs) / 1000, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block"
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
};

interface DecryptedTextProps {
  text: string;
  className?: string;
}

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const DecryptedText: React.FC<DecryptedTextProps> = ({ text, className = '' }) => {
  const [display, setDisplay] = useState(text);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (!hovering) return;
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      const resolvedCount = Math.floor((frame / 10) * text.length);
      const next = text
        .split('')
        .map((ch, idx) => {
          if (ch === ' ' || idx < resolvedCount) return ch;
          return SCRAMBLE_CHARS[(idx + frame) % SCRAMBLE_CHARS.length];
        })
        .join('');
      setDisplay(next);
      if (frame >= 10) {
        setDisplay(text);
        window.clearInterval(id);
      }
    }, 28);
    return () => window.clearInterval(id);
  }, [hovering, text]);

  return (
    <span
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        setDisplay(text);
      }}
      className={`inline-block transition-colors ${className}`}
    >
      {hovering ? display : text}
    </span>
  );
};

interface TextTypeProps {
  strings: string[];
  typingSpeedMs?: number;
  pauseMs?: number;
  className?: string;
}

export const TextType: React.FC<TextTypeProps> = ({
  strings,
  typingSpeedMs = 42,
  pauseMs = 1800,
  className = '',
}) => {
  const [stringIdx, setStringIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(strings[0]?.length || 0);

  useEffect(() => {
    if (strings.length === 0) return;
    const target = strings[stringIdx] || '';
    if (charIdx < target.length) {
      const id = window.setTimeout(() => setCharIdx((c) => c + 1), typingSpeedMs);
      return () => window.clearTimeout(id);
    }
    const pauseId = window.setTimeout(() => {
      setStringIdx((i) => (i + 1) % strings.length);
      setCharIdx(0);
    }, pauseMs);
    return () => window.clearTimeout(pauseId);
  }, [charIdx, stringIdx, strings, typingSpeedMs, pauseMs]);

  const currentText = (strings[stringIdx] || '').slice(0, charIdx);
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span>{currentText}</span>
      <span className="inline-block w-[2px] h-[1em] bg-[#ff5500] ml-0.5 animate-pulse" />
    </span>
  );
};

interface TrueFocusProps {
  items: string[];
  intervalMs?: number;
  className?: string;
}

export const TrueFocus: React.FC<TrueFocusProps> = ({
  items,
  intervalMs = 2200,
  className = '',
}) => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % items.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [items.length, intervalMs]);

  return (
    <div className={`inline-flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {items.map((item, idx) => {
        const isFocused = idx === active;
        return (
          <span
            key={item}
            onMouseEnter={() => setActive(idx)}
            className={`relative px-2.5 py-1 text-xs font-bold rounded-lg transition-all duration-300 cursor-default ${
              isFocused
                ? 'text-[#0f0f14] bg-white border border-[#ff5500]/60 shadow-2xs blur-0 opacity-100'
                : 'text-[#6e6e7e] opacity-65 blur-[0.4px]'
            }`}
          >
            {isFocused && (
              <>
                <span className="absolute -top-0.5 -left-0.5 w-1.5 h-1.5 border-t-2 border-l-2 border-[#ff5500] rounded-tl-[2px]" />
                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 border-b-2 border-r-2 border-[#ff5500] rounded-br-[2px]" />
              </>
            )}
            {item}
          </span>
        );
      })}
    </div>
  );
};
