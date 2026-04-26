import React from 'react';

interface IslamicPatternProps {
  opacity?: number;
  color?: string;
  size?: number;
  className?: string;
}

export default function IslamicPattern({
  opacity = 0.15,
  color = '#C9A84C',
  size = 80,
  className = '',
}: IslamicPatternProps) {
  const patternId = `islamic-pattern-${Math.random().toString(36).substr(2, 9)}`;
  const half = size / 2;
  const r = half * 0.85;

  // 8-pointed star points calculation
  const outerR = half * 0.72;
  const innerR = half * 0.32;
  const points8Star = Array.from({ length: 8 }, (_, i) => {
    const outerAngle = (i * 45 - 90) * (Math.PI / 180);
    const innerAngle = ((i * 45 + 22.5) - 90) * (Math.PI / 180);
    const ox = half + outerR * Math.cos(outerAngle);
    const oy = half + outerR * Math.sin(outerAngle);
    const ix = half + innerR * Math.cos(innerAngle);
    const iy = half + innerR * Math.sin(innerAngle);
    return `${ox},${oy} ${ix},${iy}`;
  }).join(' ');

  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ opacity }}
    >
      <defs>
        <pattern
          id={patternId}
          x="0"
          y="0"
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
        >
          <g fill="none" stroke={color} strokeWidth="0.8">
            {/* 8-pointed star */}
            <polygon points={points8Star} fill={color} fillOpacity="0.3" />

            {/* Outer circle */}
            <circle cx={half} cy={half} r={r * 0.9} strokeDasharray="3,5" />

            {/* Inner decorative square rotated 45deg */}
            <rect
              x={half - r * 0.5}
              y={half - r * 0.5}
              width={r}
              height={r}
              transform={`rotate(45 ${half} ${half})`}
            />

            {/* Cross lines */}
            <line x1={half} y1="2" x2={half} y2={size - 2} strokeDasharray="1,8" />
            <line x1="2" y1={half} x2={size - 2} y2={half} strokeDasharray="1,8" />

            {/* Corner dots */}
            <circle cx="0" cy="0" r="2" fill={color} />
            <circle cx={size} cy="0" r="2" fill={color} />
            <circle cx="0" cy={size} r="2" fill={color} />
            <circle cx={size} cy={size} r="2" fill={color} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

/**
 * Standalone decorative star used as icon/accent
 */
export function IslamicStar({
  size = 40,
  color = '#C9A84C',
  className = '',
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  const half = size / 2;
  const outerR = half * 0.88;
  const innerR = half * 0.38;

  const points = Array.from({ length: 8 }, (_, i) => {
    const outerAngle = (i * 45 - 90) * (Math.PI / 180);
    const innerAngle = ((i * 45 + 22.5) - 90) * (Math.PI / 180);
    const ox = half + outerR * Math.cos(outerAngle);
    const oy = half + outerR * Math.sin(outerAngle);
    const ix = half + innerR * Math.cos(innerAngle);
    const iy = half + innerR * Math.sin(innerAngle);
    return `${ox.toFixed(2)},${oy.toFixed(2)} ${ix.toFixed(2)},${iy.toFixed(2)}`;
  }).join(' ');

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon points={points} fill={color} />
      <circle cx={half} cy={half} r={half * 0.2} fill="#FFFFFF" fillOpacity="0.4" />
    </svg>
  );
}
