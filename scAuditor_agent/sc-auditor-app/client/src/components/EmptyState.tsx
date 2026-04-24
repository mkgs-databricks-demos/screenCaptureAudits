interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-[fadeIn_var(--motion-normal)_var(--ease-out)]">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[var(--surface-tertiary)] flex items-center justify-center mb-4 text-[var(--text-secondary)]">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-md mb-6">{description}</p>
      {action}
    </div>
  );
}
