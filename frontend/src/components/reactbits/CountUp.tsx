import React, { useEffect, useState } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number;
  separator?: string;
  className?: string;
  decimals?: number;
}

export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  duration = 1.2,
  separator = ',',
  className = '',
  decimals = 0,
}) => {
  const [count, setCount] = useState(from);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      // Smooth ease-out exponential
      const current = from + (to - from) * (1 - Math.pow(2, -10 * progress));
      setCount(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setCount(to);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [to, from, duration]);

  const formatted = decimals > 0
    ? count.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(count).toLocaleString('en-IN');

  return <span className={className}>{formatted}</span>;
};

export default CountUp;
