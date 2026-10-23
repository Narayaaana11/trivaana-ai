import React, { useEffect, useState } from 'react';

interface BlurTextProps {
  text: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
}

export const BlurText: React.FC<BlurTextProps> = ({
  text = '',
  delay = 50,
  className = '',
  animateBy = 'words',
}) => {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setInView(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span className={`inline-flex flex-wrap gap-x-2 ${className}`}>
      {elements.map((element, index) => (
        <span
          key={index}
          style={{
            transition: `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * delay}ms, filter 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * delay}ms, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * delay}ms`,
            opacity: inView ? 1 : 0,
            filter: inView ? 'blur(0px)' : 'blur(10px)',
            transform: inView ? 'translateY(0)' : 'translateY(12px)',
          }}
          className="inline-block"
        >
          {element}
        </span>
      ))}
    </span>
  );
};

export default BlurText;
