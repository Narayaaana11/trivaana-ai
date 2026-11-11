import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  compact = false,
}) => {
  return (
    <div
      className={`rounded-2xl border border-dashed border-[#e4e4e9] bg-white/80 flex flex-col items-center justify-center text-center ${
        compact ? 'p-6' : 'p-10 sm:p-12'
      }`}
    >
      <div className="w-11 h-11 rounded-2xl bg-[#fff7ed] border border-[#fed7aa] text-[#ff5500] flex items-center justify-center mb-3 shadow-2xs">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-display text-sm font-bold text-[#0f0f14]">{title}</h3>
      <p className="text-xs text-[#525260] max-w-md mt-1 leading-relaxed">{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="px-4 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ea580c] text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="px-4 py-2 rounded-xl bg-[#f6f6f8] hover:bg-[#ebebf0] border border-[#e4e4e9] text-[#0f0f14] text-xs font-semibold cursor-pointer transition-colors"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

