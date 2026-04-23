import { cn } from '@/lib/utils';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--foreground)]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm',
          'placeholder:text-[var(--muted-foreground)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--dbx-lava-600)] focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
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
        <label htmlFor={id} className="text-sm font-medium text-[var(--foreground)]">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          'rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm',
          'placeholder:text-[var(--muted-foreground)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--dbx-lava-600)] focus:border-transparent',
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
        <label htmlFor={id} className="text-sm font-medium text-[var(--foreground)]">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          'rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-[var(--dbx-lava-600)] focus:border-transparent',
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
