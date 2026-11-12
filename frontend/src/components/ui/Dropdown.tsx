import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DropdownPanelProps {
  open: boolean;
  onClose?: () => void;
  align?: 'left' | 'right';
  widthClass?: string;
  className?: string;
  children: React.ReactNode;
}

export const DropdownPanel: React.FC<DropdownPanelProps> = ({
  open,
  onClose,
  align = 'right',
  widthClass = 'w-72',
  className,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !onClose) return;
    const handlePointerDown = (e: MouseEvent) => {
      const parent = panelRef.current?.parentElement;
      if (parent && !parent.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="menu"
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 460, damping: 32 }}
          className={cn(
            'absolute top-full mt-2 z-50 rounded-2xl bg-white border border-[#e4e4e9] shadow-2xl p-2 text-xs',
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            widthClass,
            className
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

