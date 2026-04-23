interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center mb-4 text-[var(--muted-foreground)]">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-[var(--muted-foreground)] max-w-md mb-6">
        {description}
      </p>
      {action}
    </div>
  );
}
