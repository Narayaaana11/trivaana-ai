import React from 'react';

export interface BackgroundPatternProps {
  variant?: 'hero' | 'dashboard' | 'subtle' | 'dots';
  className?: string;
  children?: React.ReactNode;
}

export const BackgroundPattern: React.FC<BackgroundPatternProps> = ({
  variant = 'hero',
  className = '',
  children
}) => {
  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      {/* 1. Ambient Diffused Glow Orbs */}
      {variant === 'hero' && (
        <>
          {/* Primary Radiant Orange Ambient Aura */}
          <div
            className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none opacity-80"
            style={{
              background: 'radial-gradient(circle, rgba(255, 85, 0, 0.15) 0%, rgba(255, 122, 26, 0.06) 50%, transparent 75%)',
              filter: 'blur(75px)',
            }}
          />
          {/* Secondary Warm Golden Amber Glow */}
          <div
            className="absolute top-24 -left-24 w-[450px] h-[340px] rounded-full pointer-events-none opacity-60"
            style={{
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
          {/* Subtle Accent Glow on the right */}
          <div
            className="absolute top-44 -right-24 w-[420px] h-[350px] rounded-full pointer-events-none opacity-50"
            style={{
              background: 'radial-gradient(circle, rgba(255, 107, 0, 0.10) 0%, transparent 70%)',
              filter: 'blur(85px)',
            }}
          />
        </>
      )}

      {variant === 'dashboard' && (
        <>
          {/* Dashboard Command Center Header Ambient Aura */}
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[920px] h-[240px] rounded-full pointer-events-none opacity-70"
            style={{
              background: 'radial-gradient(ellipse, rgba(255, 85, 0, 0.10) 0%, rgba(245, 158, 11, 0.05) 50%, transparent 80%)',
              filter: 'blur(65px)',
            }}
          />
        </>
      )}

      {variant === 'subtle' && (
        <div
          className="absolute -top-20 right-1/4 w-[520px] h-[320px] rounded-full pointer-events-none opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(255, 85, 0, 0.08) 0%, transparent 70%)',
            filter: 'blur(75px)',
          }}
        />
      )}

      {/* 2. Precision Architectural Blueprint Grid / Dot Matrix with Radial Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: variant === 'dots'
            ? 'radial-gradient(#CBD5E1 1.2px, transparent 1.2px)'
            : 'linear-gradient(to right, rgba(226, 232, 240, 0.75) 1px, transparent 1px), linear-gradient(to bottom, rgba(226, 232, 240, 0.75) 1px, transparent 1px)',
          backgroundSize: variant === 'dots' ? '24px 24px' : '40px 40px',
          maskImage: 'radial-gradient(ellipse 75% 65% at 50% 30%, #000 35%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 30%, #000 35%, transparent 100%)',
        }}
      />

      {/* Content Container */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default BackgroundPattern;
