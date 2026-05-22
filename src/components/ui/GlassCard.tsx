'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'elevated' | 'highlight';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  variant?: Variant;
  padding?: string;
}

const variantClass: Record<Variant, string> = {
  default: 'glass-card',
  elevated: 'glass-card-elevated',
  highlight: 'glass-card-highlight',
};

export default function GlassCard({
  variant = 'default',
  padding = 'p-5',
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(variantClass[variant], padding, className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
