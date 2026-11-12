import React from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Motion Primitives: InView (MIT) ────────────────────────────────────── */
interface InViewProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
  once?: boolean;
}

export const InView: React.FC<InViewProps> = ({
  children,
  className,
  delay = 0,
  yOffset = 18,
  once = true,
}) => (
  <motion.div
    initial={{ opacity: 0, y: yOffset }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once, margin: '-60px' }}
    transition={{ duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

/* ── Motion Primitives: TextEffect (MIT) ────────────────────────────────── */
interface TextEffectProps {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}

export const TextEffect: React.FC<TextEffectProps> = ({
  text,
  className,
  delay = 0,
  stagger = 0.04,
}) => {
  const words = text.split(' ');
  const container: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <motion.span
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      className={cn('inline-flex flex-wrap gap-x-[0.28em]', className)}
    >
      {words.map((word, idx) => (
        <motion.span key={`${word}-${idx}`} variants={item} className="inline-block">
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
};

/* ── Motion Primitives: SlidingNumber (MIT) ─────────────────────────────── */
interface SlidingNumberProps {
  value: number | string;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const SlidingNumber: React.FC<SlidingNumberProps> = ({
  value,
  prefix = '',
  suffix = '',
  className,
}) => {
  const formatted =
    typeof value === 'number' ? value.toLocaleString('en-IN') : value;

  return (
    <span className={cn('inline-flex items-baseline tabular-nums overflow-hidden', className)}>
      {prefix && <span>{prefix}</span>}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={formatted}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          className="inline-block"
        >
          {formatted}
        </motion.span>
      </AnimatePresence>
      {suffix && <span>{suffix}</span>}
    </span>
  );
};

/* ── Motion Primitives: TransitionPanel (MIT) ───────────────────────────── */
interface TransitionPanelProps {
  activeKey: string;
  children: React.ReactNode;
  className?: string;
}

export const TransitionPanel: React.FC<TransitionPanelProps> = ({
  activeKey,
  children,
  className,
}) => (
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={activeKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

