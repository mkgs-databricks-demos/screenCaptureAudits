import { cn } from '@/lib/utils';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({ label, error, icon, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={id}
          className={cn(
            'w-full rounded-lg border bg-[var(--surface-raised)] py-2 text-sm text-[var(--text-primary)]',
            icon ? 'pl-10 pr-3' : 'px-3',
            'placeholder:text-[var(--text-tertiary)]',
            'transition-all duration-[var(--motion-fast)] ease-[var(--ease-out)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-[var(--accent-error)] focus:ring-2 focus:ring-[var(--accent-error)] focus:border-transparent'
              : 'border-[var(--border-default)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent focus:outline-none',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-[var(--accent-error)]">{error}</p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className, id, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          'rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)]',
          'placeholder:text-[var(--text-tertiary)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent',
          'transition-all duration-[var(--motion-fast)] ease-[var(--ease-out)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'resize-y min-h-[80px]',
          className
        )}
        {...props}
      />
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  icon?: ReactNode;
  options: { value: string; label: string }[];
}

export function Select({ label, icon, options, className, id, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none">
            {icon}
          </div>
        )}
        <select
          id={id}
          className={cn(
            'w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] py-2 text-sm text-[var(--text-primary)]',
            icon ? 'pl-10 pr-3' : 'px-3',
            'focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent',
            'transition-all duration-[var(--motion-fast)] ease-[var(--ease-out)]',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
