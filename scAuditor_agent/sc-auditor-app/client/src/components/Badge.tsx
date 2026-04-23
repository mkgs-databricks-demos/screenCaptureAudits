import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'warning' | 'error' | 'info';

const variants: Record<Variant, string> = {
  default: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
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
