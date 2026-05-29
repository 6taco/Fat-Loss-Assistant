'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: number;
  className?: string;
}

export default function ProgressBar({
  value,
  color = '#0A84FF',
  height = 6,
  className = '',
}: ProgressBarProps) {
  return (
    <div
      className={`w-full rounded-full overflow-hidden ${className}`}
      style={{ height, background: 'rgba(96,74,48,0.08)' }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}
