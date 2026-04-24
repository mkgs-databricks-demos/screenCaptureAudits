import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantStyles: Record<Variant, string> = {
  primary: [
    'bg-[var(--accent-primary)] text-[var(--text-on-accent)]',
    'hover:bg-[var(--accent-primary-hover)]',
    'active:brightness-90',
    'shadow-sm shadow-[var(--accent-primary)]/20',
  ].join(' '),
  secondary: [
    'bg-transparent border border-[var(--border-default)] text-[var(--text-primary)]',
    'hover:bg-[var(--surface-tertiary)] hover:border-[var(--border-strong)]',
  ].join(' '),
  ghost: [
    'bg-transparent text-[var(--text-secondary)]',
    'hover:bg-[var(--surface-tertiary)] hover:text-[var(--text-primary)]',
  ].join(' '),
  danger: [
    'bg-[var(--accent-error)] text-[var(--text-on-accent)]',
    'hover:brightness-90',
    'shadow-sm shadow-[var(--accent-error)]/20',
  ].join(' '),
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-7 rounded-md',
  md: 'px-4 py-2 text-sm min-h-9 rounded-lg',
  lg: 'px-6 py-3 text-base min-h-11 rounded-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium',
        'transition-all duration-[var(--motion-fast)] ease-[var(--ease-out)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-primary)]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled}
      {...props}
    />
  );
}
