import React from 'react';
import { motion } from 'framer-motion';
import { Bell, PhoneCall, Square, Play } from 'lucide-react';

interface VoicePillProps {
  active?: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}

export const VoicePill: React.FC<VoicePillProps> = ({
  active = false,
  label,
  onClick,
  className = '',
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-bold cursor-pointer transition-all ${
      active
        ? 'bg-[#0f0f14] text-white shadow-md ring-2 ring-[#ff5500]/30'
        : 'bg-[#f6f6f8] hover:bg-[#ebebf0] text-[#0f0f14] border border-[#e4e4e9]'
    } ${className}`}
  >
    {active ? (
      <Square className="w-3 h-3 text-[#ff5500] fill-[#ff5500] shrink-0" />
    ) : (
      <Play className="w-3 h-3 text-[#ff5500] fill-[#ff5500] shrink-0" />
    )}
    <span className="flex items-center gap-[2px] h-3.5" aria-hidden="true">
      {[0, 1, 2, 3].map((bar) => (
        <span
          key={bar}
          style={
            active
              ? {
                  animation: `rb-voice-wave ${0.55 + bar * 0.12}s ease-in-out infinite`,
                  animationDelay: `${bar * 0.1}s`,
                }
              : undefined
          }
          className={`w-[2.5px] rounded-full origin-center transition-all ${
            active
              ? 'h-3.5 bg-[#ff5500]'
              : bar % 2 === 0
              ? 'h-2 bg-[#ff5500]/70'
              : 'h-3 bg-[#ff5500]/50'
          }`}
        />
      ))}
    </span>
    <span>{label}</span>
  </button>
);

interface StatusMarkProps {
  status?: 'online' | 'busy' | 'idle';
  label?: string;
  className?: string;
}

export const StatusMark: React.FC<StatusMarkProps> = ({
  status = 'online',
  label,
  className = '',
}) => {
  const color =
    status === 'online'
      ? 'bg-emerald-500'
      : status === 'busy'
      ? 'bg-[#ff5500]'
      : 'bg-slate-400';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {status !== 'idle' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-65 ${color}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
      </span>
      {label && <span className="text-[11px] font-semibold">{label}</span>}
    </span>
  );
};

interface SquishSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  className?: string;
}

export const SquishSwitch: React.FC<SquishSwitchProps> = ({
  checked,
  onChange,
  label,
  className = '',
}) => (
  <label className={`inline-flex items-center gap-2 cursor-pointer select-none ${className}`}>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center cursor-pointer ${
        checked ? 'bg-[#ff5500] justify-end' : 'bg-slate-600/50 justify-start'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 550, damping: 30 }}
        className="w-4 h-4 rounded-full bg-white shadow-xs"
      />
    </button>
    {label && <span className="text-xs font-medium">{label}</span>}
  </label>
);

interface BellToggleProps {
  unreadCount: number;
  onClick: () => void;
  className?: string;
}

export const BellToggle: React.FC<BellToggleProps> = ({
  unreadCount,
  onClick,
  className = '',
}) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileTap={{ scale: 0.92 }}
    whileHover={unreadCount > 0 ? { rotate: [0, -10, 10, -6, 0] } : undefined}
    className={`p-2 rounded-xl bg-[#f6f6f8] hover:bg-[#ebebf0] border border-[#e4e4e9] text-[#525260] relative cursor-pointer ${className}`}
    aria-label="Notifications"
  >
    <Bell className="w-4 h-4" />
    {unreadCount > 0 && (
      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff5500] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
        {unreadCount}
      </span>
    )}
  </motion.button>
);

interface CallChipProps {
  name: string;
  status: string;
  className?: string;
}

export const CallChip: React.FC<CallChipProps> = ({ name, status, className = '' }) => (
  <div
    className={`px-3 py-2 rounded-xl bg-[#f6f6f8] border border-[#e4e4e9] flex items-center justify-between gap-2 text-xs ${className}`}
  >
    <span className="inline-flex items-center gap-2 font-bold text-[#0f0f14] truncate">
      <PhoneCall className="w-3.5 h-3.5 text-[#ff5500] shrink-0" />
      <span className="truncate">{name}</span>
    </span>
    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono-code font-bold text-[#ff5500] uppercase shrink-0">
      <StatusMark status="busy" />
      {status}
    </span>
  </div>
);

interface WarmTooltipProps {
  tip: string;
  children: React.ReactNode;
}

export const WarmTooltip: React.FC<WarmTooltipProps> = ({ tip, children }) => (
  <span className="relative inline-flex group/tip">
    {children}
    <span
      role="tooltip"
      className="pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-lg bg-[#121019] text-white text-[10px] font-medium whitespace-nowrap shadow-lg z-40"
    >
      {tip}
    </span>
  </span>
);

