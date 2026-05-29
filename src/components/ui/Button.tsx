'use client';

import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const base = 'inline-flex items-center justify-center font-semibold transition-all duration-150 cursor-pointer select-none active:scale-[0.97]';

const variants: Record<Variant, string> = {
  primary:
    'gradient-accent text-white rounded-full h-[50px] px-8 text-[16px] shadow-[0_10px_24px_rgba(103,181,107,0.28)] active:brightness-95',
  secondary:
    'glass-card rounded-full h-[44px] px-6 text-[15px] text-text-primary',
  ghost:
    'bg-transparent text-text-secondary hover:bg-glass rounded-full h-[44px] px-4 text-[15px]',
  icon:
    'glass-card rounded-full w-10 h-10 p-0',
};

export default function Button({
  variant = 'primary',
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], fullWidth && 'w-full', className)}
      {...props}
    >
      {children}
    </button>
  );
}
