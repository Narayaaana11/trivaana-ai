import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AccordionItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  category?: string;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpenId?: string;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  items,
  defaultOpenId,
  className,
}) => {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? items[0]?.id ?? null);

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            className={cn(
              'rounded-2xl border bg-white transition-colors',
              isOpen ? 'border-[#ff5500]/40 shadow-sm' : 'border-[#e4e4e9] hover:border-[#d4d4dc]'
            )}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`accordion-panel-${item.id}`}
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.category && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] shrink-0">
                    {item.category}
                  </span>
                )}
                <span className="font-display text-sm sm:text-base font-bold text-[#0f0f14]">
                  {item.question}
                </span>
              </div>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="w-7 h-7 rounded-full bg-[#f6f6f8] border border-[#e4e4e9] flex items-center justify-center shrink-0 text-[#525260]"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`accordion-panel-${item.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 pt-0 text-xs sm:text-sm text-[#525260] leading-relaxed border-t border-[#e4e4e9]/60 mt-1 pt-3">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

