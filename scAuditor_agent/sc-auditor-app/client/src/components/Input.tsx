import { cn } from '@/lib/utils';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'rounded-lg border bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)]',
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
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, id, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          'rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)]',
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
  );
}
