import React from 'react';
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
  showTagline = false,
  textColor = '#0F172A',
  subtitle = "India's Most Natural Voice AI",
  animated = false,
}) => {
  const numericSize =
    typeof size === 'number'
      ? size
      : size === 'sm'
      ? 28
      : size === 'lg'
      ? 48
      : 36;

  return (
    <div className={`inline-flex items-center gap-3 ${className} group select-none`}>
      {/* Redesigned Modern Vector Brandmark Container */}
      <div
        style={{ width: numericSize, height: numericSize }}
        className="relative rounded-xl bg-gradient-to-br from-orange-500 via-orange-600 to-amber-500 p-[1.5px] shadow-md shadow-orange-500/25 flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105 group-hover:shadow-orange-500/40"
      >
        <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center p-1.5 overflow-hidden relative">
          {/* Subtle Ambient Radial Highlight inside badge */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,85,0,0.12),transparent_70%)]" />

          {/* Precision SVG Vector Mark: Dynamic 'T' + Acoustic Voice Frequencies */}
          <svg
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full relative z-10"
          >
            <defs>
              <linearGradient id="trivaanaGrad" x1="4" y1="6" x2="44" y2="42" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FF3B30" />
                <stop offset="50%" stopColor="#FF5500" />
                <stop offset="100%" stopColor="#FFAA00" />
              </linearGradient>
              <linearGradient id="trivaanaStemGrad" x1="24" y1="14" x2="24" y2="42" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FF5500" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>
            </defs>

            {/* Top Soundwave Crossbar forming the 'T' top */}
            <path
              d="M 6 12 C 12 12 16 8 24 8 C 32 8 36 12 42 12 C 44 12 45 14 43.5 15.5 C 41 18 36 17 24 17 C 12 17 7 18 4.5 15.5 C 3 14 4 12 6 12 Z"
              fill="url(#trivaanaGrad)"
            />

            {/* Left Flanking Frequency Wave Bar */}
            <rect
              x="10"
              y="20"
              width="3.5"
              height="10"
              rx="1.75"
              fill="url(#trivaanaGrad)"
              opacity="0.85"
              className={animated ? "animate-pulse" : ""}
            />

            {/* Central Vertical Audio Stem forming the 'T' pillar */}
            <path
              d="M 21.5 18 C 21.5 17 26.5 17 26.5 18 L 26.5 35 C 26.5 38 24 41 24 41 C 24 41 21.5 38 21.5 35 Z"
              fill="url(#trivaanaStemGrad)"
            />

            {/* Center Core Neural AI Node */}
            <circle cx="24" cy="24" r="3" fill="#FFFFFF" />
            <circle cx="24" cy="24" r="1.75" fill="#FF5500" />

            {/* Right Flanking Frequency Wave Bar */}
            <rect
              x="34.5"
              y="20"
              width="3.5"
              height="10"
              rx="1.75"
              fill="url(#trivaanaGrad)"
              opacity="0.85"
              className={animated ? "animate-pulse" : ""}
            />

            {/* Outer Vernacular Resonance Arcs */}
            <path
              d="M 4 23 C 4 21 6 20 6 25 C 6 30 4 29 4 27 Z"
              fill="url(#trivaanaGrad)"
              opacity="0.5"
            />
            <path
              d="M 44 23 C 44 21 42 20 42 25 C 42 30 44 29 44 27 Z"
              fill="url(#trivaanaGrad)"
              opacity="0.5"
            />
          </svg>
        </div>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <span
              className="font-extrabold tracking-tight text-base sm:text-lg leading-tight transition-colors group-hover:text-orange-600"
              style={{ color: textColor }}
            >
              {BRAND.shortName}
            </span>
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-[10px] px-1.5 py-0.5 rounded shadow-2xs tracking-wider uppercase">
              AI
            </span>
          </div>
          {subtitle && (
            <span className="text-[10px] text-slate-500 font-medium tracking-tight">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default TrivaanaLogo;
