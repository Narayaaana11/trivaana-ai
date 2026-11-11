import React, { useId } from 'react';
import BRAND from '@/lib/brand';

export interface TrivaanaLogoProps {
  size?: number | 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
  showTagline?: boolean;
  textColor?: string;
  subtitle?: string;
  animated?: boolean;
}

export const TrivaanaLogo: React.FC<TrivaanaLogoProps> = ({
  size = 36,
  className = '',
  showText = true,
  showTagline: _showTagline = false,
  textColor = '#0f0f14',
  subtitle = "India's Most Natural Voice AI",
  animated = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const numericSize =
    typeof size === 'number'
      ? size
      : size === 'sm'
      ? 30
      : size === 'lg'
      ? 48
      : 36;

  const badgeGradId = `trvBg-${uid}`;
  const glossGradId = `trvGloss-${uid}`;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className} group select-none`}>
      {/* Precision Acoustic 'T' Voice Emblem */}
      <div
        style={{ width: numericSize, height: numericSize }}
        className="relative shrink-0 transition-transform duration-300 group-hover:scale-105"
      >
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_4px_10px_rgba(255,85,0,0.28)]"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={badgeGradId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF3B00" />
              <stop offset="52%" stopColor="#FF5500" />
              <stop offset="100%" stopColor="#FF9500" />
            </linearGradient>
            <linearGradient id={glossGradId} x1="32" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Outer Squircle Emblem */}
          <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${badgeGradId})`} />
          <rect
            x="3"
            y="3"
            width="58"
            height="58"
            rx="15"
            stroke="#FFFFFF"
            strokeOpacity="0.24"
            strokeWidth="1.5"
          />
          <rect x="4" y="4" width="56" height="28" rx="14" fill={`url(#${glossGradId})`} />

          {/* Arched Acoustic 'T' Crossbar */}
          <path
            d="M15 21.5C22.5 16.8 41.5 16.8 49 21.5"
            stroke="#FFFFFF"
            strokeWidth="6.2"
            strokeLinecap="round"
          />

          {/* Central Resonance Pillar */}
          <rect x="28.75" y="23" width="6.5" height="26" rx="3.25" fill="#FFFFFF" />

          {/* Inner Left & Right Frequency Bars */}
          <rect
            x="20.5"
            y="28.5"
            width="4.5"
            height="14.5"
            rx="2.25"
            fill="#FFFFFF"
            fillOpacity="0.92"
            className={animated ? 'animate-pulse' : ''}
          />
          <rect
            x="39"
            y="28.5"
            width="4.5"
            height="14.5"
            rx="2.25"
            fill="#FFFFFF"
            fillOpacity="0.92"
            className={animated ? 'animate-pulse' : ''}
          />

          {/* Outer Harmonic Harmonies */}
          <rect
            x="13"
            y="32.5"
            width="4"
            height="7.5"
            rx="2"
            fill="#FFFFFF"
            fillOpacity="0.72"
            className={animated ? 'animate-pulse' : ''}
          />
          <rect
            x="47"
            y="32.5"
            width="4"
            height="7.5"
            rx="2"
            fill="#FFFFFF"
            fillOpacity="0.72"
            className={animated ? 'animate-pulse' : ''}
          />
        </svg>
      </div>

      {/* Wordmark */}
      {showText && (
        <div className="flex flex-col text-left leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className="font-display font-extrabold tracking-[-0.03em] text-base sm:text-[18px] transition-colors group-hover:text-[#ff5500]"
              style={{ color: textColor }}
            >
              {BRAND.shortName}
            </span>
            <span className="bg-gradient-to-tr from-[#ff4d00] to-[#ff8c00] text-white font-display font-extrabold text-[9.5px] px-1.5 py-0.5 rounded-md shadow-2xs tracking-[0.08em] uppercase">
              AI
            </span>
          </div>
          {subtitle && (
            <span className="text-[10px] text-[#6e6e7e] font-medium tracking-tight mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default TrivaanaLogo;
