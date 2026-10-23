import React from 'react';

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  color?: string;
  shineColor?: string;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 3,
  className = '',
  color = '#475569',
  shineColor = '#ff5500',
}) => {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={`inline-block font-semibold bg-clip-text ${disabled ? '' : 'animate-shine'} ${className}`}
      style={{
        backgroundImage: `linear-gradient(120deg, ${color} 0%, ${color} 40%, ${shineColor} 50%, ${color} 60%, ${color} 100%)`,
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        animationDuration: animationDuration,
        color: 'transparent',
      }}
    >
      {text}
    </span>
  );
};

export default ShinyText;
