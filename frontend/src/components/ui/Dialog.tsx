import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  maxWidthClass?: string;
  variant?: 'light' | 'dark';
  noPadding?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  maxWidthClass = 'max-w-lg',
  variant = 'light',
  noPadding = false,
  className,
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title || 'Dialog'}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0f0f14]/55 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={cn(
              'relative z-10 w-full rounded-3xl shadow-2xl overflow-hidden',
              variant === 'dark'
                ? 'bg-[#121019] text-white border border-white/15'
                : 'bg-white text-[#0f0f14] border border-[#e4e4e9]',
              maxWidthClass,
              className
            )}
          >
            {(title || description) && (
              <div
                className={cn(
                  'px-6 py-4 border-b flex items-start justify-between gap-4',
                  variant === 'dark' ? 'border-white/10' : 'border-[#e4e4e9]'
                )}
              >
                <div>
                  {title && (
                    <h2
                      className={cn(
                        'font-display text-base font-extrabold',
                        variant === 'dark' ? 'text-white' : 'text-[#0f0f14]'
                      )}
                    >
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p
                      className={cn(
                        'text-xs mt-0.5',
                        variant === 'dark' ? 'text-slate-400' : 'text-[#525260]'
                      )}
                    >
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className={cn(
                    'p-1.5 rounded-xl cursor-pointer transition-colors',
                    variant === 'dark'
                      ? 'hover:bg-white/10 text-slate-400 hover:text-white'
                      : 'hover:bg-[#f6f6f8] text-[#525260] hover:text-[#0f0f14]'
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className={noPadding ? '' : 'p-6'}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

