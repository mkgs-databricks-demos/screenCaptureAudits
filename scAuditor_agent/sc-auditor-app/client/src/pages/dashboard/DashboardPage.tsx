export function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-[var(--muted-foreground)] mb-8">
        Audit overview and recent activity
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Audits', value: '0' },
          { label: 'Completed', value: '0' },
          { label: 'Screenshots', value: '0' },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6"
          >
            <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
