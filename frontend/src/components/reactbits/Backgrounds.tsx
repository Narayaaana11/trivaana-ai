import React from 'react';

interface AuroraBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({ children, className = '' }) => (
  <div className={`relative overflow-hidden ${className}`}>
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full bg-[#ff5500]/18 blur-3xl"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-24 -right-12 w-72 h-72 rounded-full bg-amber-500/12 blur-3xl"
    />
    <div className="relative z-10">{children}</div>
  </div>
);

interface DotGridBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export const DotGridBackground: React.FC<DotGridBackgroundProps> = ({
  children,
  className = '',
}) => (
  <div
    className={`relative ${className}`}
    style={{
      backgroundImage: 'radial-gradient(rgba(15, 15, 20, 0.08) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
    }}
  >
    {children}
  </div>
);

