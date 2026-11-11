import React from 'react';

interface BgProps {
  children: React.ReactNode;
  className?: string;
}

export const WavesBackground: React.FC<BgProps> = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden ${className}`}>
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 180"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-20 text-[#ff5500]"
    >
      <path
        d="M0,96 C240,140 420,40 640,92 C860,144 1020,56 1200,90 L1200,180 L0,180 Z"
        fill="currentColor"
      />
    </svg>
    <div className="relative z-10">{children}</div>
  </div>
);

export const RadarBackground: React.FC<BgProps> = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden ${className}`}>
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-12 -top-12 w-56 h-56 rounded-full border border-[#ff5500]/15 flex items-center justify-center"
    >
      <div className="w-36 h-36 rounded-full border border-[#ff5500]/20 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-[#ff5500]/10" />
      </div>
    </div>
    <div className="relative z-10">{children}</div>
  </div>
);

export const ParticlesBackground: React.FC<BgProps> = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden ${className}`}>
    <div
      aria-hidden="true"
      style={{
        backgroundImage:
          'radial-gradient(rgba(255, 85, 0, 0.16) 1.5px, transparent 1.5px), radial-gradient(rgba(251, 146, 60, 0.12) 1px, transparent 1px)',
        backgroundSize: '36px 36px, 22px 22px',
        backgroundPosition: '0 0, 12px 14px',
      }}
      className="pointer-events-none absolute inset-0 opacity-60"
    />
    <div className="relative z-10">{children}</div>
  </div>
);

export const GridScanBackground: React.FC<BgProps> = ({ children, className = '' }) => (
  <div
    style={{
      backgroundImage:
        'linear-gradient(to right, rgba(255, 85, 0, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 85, 0, 0.05) 1px, transparent 1px)',
      backgroundSize: '32px 32px',
    }}
    className={`relative ${className}`}
  >
    {children}
  </div>
);

export const ThreadsBackground: React.FC<BgProps> = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden ${className}`}>
    <svg
      aria-hidden="true"
      viewBox="0 0 800 120"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-15 text-[#ff5500]"
    >
      <path d="M0 30 Q 200 90 400 30 T 800 30" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M0 60 Q 200 10 400 60 T 800 60" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M0 90 Q 200 40 400 90 T 800 90" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
    <div className="relative z-10">{children}</div>
  </div>
);

export const RipplesBackground: React.FC<BgProps> = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden ${className}`}>
    <div
      aria-hidden="true"
      style={{
        background:
          'repeating-radial-gradient(circle at 90% 20%, rgba(255, 85, 0, 0.06) 0, rgba(255, 85, 0, 0.06) 1px, transparent 1px, transparent 28px)',
      }}
      className="pointer-events-none absolute inset-0"
    />
    <div className="relative z-10">{children}</div>
  </div>
);

