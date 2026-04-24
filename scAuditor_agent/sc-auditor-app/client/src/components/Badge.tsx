import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'error' | 'info';

const variants: Record<Variant, string> = {
  default: 'bg-[var(--surface-tertiary)] text-[var(--text-secondary)]',
  success: 'bg-[var(--accent-success-subtle)] text-[var(--accent-success)]',
  warning: 'bg-[var(--accent-warning-subtle)] text-[var(--accent-warning)]',
  error:   'bg-[var(--accent-error-subtle)] text-[var(--accent-error)]',
  info:    'bg-[var(--accent-info-subtle)] text-[var(--accent-info)]',
};

const statusVariant: Record<string, Variant> = {
  active: 'info',
  paused: 'warning',
  completed: 'success',
  failed: 'error',
  pending: 'default',
  in_progress: 'info',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        'transition-colors duration-[var(--motion-fast)]',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={statusVariant[status] ?? 'default'}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
