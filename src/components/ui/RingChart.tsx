'use client';

import { motion } from 'framer-motion';

interface Ring {
  value: number;   // 0-100 percentage
  color: string;
  label: string;
  current: string;
  target: string;
}

interface RingChartProps {
  rings: Ring[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}

export default function RingChart({
  rings,
  centerValue,
  centerLabel,
  size = 160,
}: RingChartProps) {
  const strokeWidth = 8;
  const gap = 6;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {rings.map((ring, i) => {
            const radius = center - strokeWidth / 2 - i * (strokeWidth + gap);
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference * (1 - ring.value / 100);

            return (
              <g key={i}>
                {/* Track */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                />
                {/* Value */}
                <motion.circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
                  transform={`rotate(-90 ${center} ${center})`}
                  style={{ filter: `drop-shadow(0 0 4px ${ring.color}40)` }}
                />
              </g>
            );
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold text-text-primary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {centerValue}
          </motion.span>
          <span className="text-[11px] text-text-tertiary">{centerLabel}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5">
        {rings.map((ring, i) => (
          <div key={i} className="text-center">
            <p className="text-[10px] text-text-tertiary mb-0.5">{ring.label}</p>
            <p className="text-[13px] font-semibold">
              <span style={{ color: ring.color }}>{ring.current}</span>
              <span className="text-text-tertiary">/{ring.target}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
