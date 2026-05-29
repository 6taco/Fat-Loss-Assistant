'use client';

import { cn } from '@/lib/utils';

type Variant = 'default' | 'elevated' | 'highlight';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: string;
}

import React from 'react';

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
    <div
      className={cn(variantClass[variant], padding, className)}
      {...props}
    >
      {children}
    </div>
  );
}
