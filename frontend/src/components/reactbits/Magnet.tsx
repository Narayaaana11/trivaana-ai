import React, { useRef, useState } from 'react';

interface MagnetProps {
  children: React.ReactNode;
  padding?: number;
  magnetStrength?: number;
  className?: string;
}

export const Magnet: React.FC<MagnetProps> = ({
  children,
  padding = 40,
  magnetStrength = 2,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;

    const distX = e.clientX - centerX;
    const distY = e.clientY - centerY;

    if (Math.abs(distX) < width / 2 + padding && Math.abs(distY) < height / 2 + padding) {
      setPosition({ x: distX / magnetStrength, y: distY / magnetStrength });
    } else {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: 'transform 0.15s ease-out',
      }}
      className={`inline-block ${className}`}
    >
      {children}
    </div>
  );
};

export default Magnet;
