import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/Badge';
import { Input } from '@/components/Input';
import { Select } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
import { listAudits, type AuditSession } from '@/lib/api';
import { ClipboardCheck, Search } from 'lucide-react';

export function HistoryPage() {
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    listAudits()
      .then((data) => setSessions(data.sessions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = sessions.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.target_system.toLowerCase().includes(q) ||
        (s.audit_type?.toLowerCase().includes(q) ?? false) ||
        s.user_id.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function duration(start: string, end: string | null) {
    if (!end) return '--';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.round(ms / 60_000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">Audit History</h1>
      <p className="text-[var(--muted-foreground)] mb-6">
        Browse past audit sessions. Filter by target system, audit type, or status.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by system, type, user, or session ID..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--dbx-lava-600)]"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'completed', label: 'Completed' },
            { value: 'failed', label: 'Failed' },
            { value: 'paused', label: 'Paused' },
          ]}
        />
      </div>

      {/* Results */}
      <Card>
        {loading ? (
          <div className="px-6 py-12 text-center text-[var(--muted-foreground)]">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck size={28} />}
            title="No sessions found"
            description={
              sessions.length === 0
                ? 'Completed audits will appear here.'
                : 'Try adjusting your search or filters.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted-foreground)]">
                  <th className="px-6 py-3 font-medium">Target System</th>
                  <th className="px-6 py-3 font-medium">Audit Type</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Started</th>
                  <th className="px-6 py-3 font-medium">Duration</th>
                  <th className="px-6 py-3 font-medium">User</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                  >
                    <td className="px-6 py-3 font-medium">{s.target_system}</td>
                    <td className="px-6 py-3 text-[var(--muted-foreground)]">
                      {s.audit_type ?? '--'}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-6 py-3 text-[var(--muted-foreground)]">
                      {formatDate(s.started_at)}
                    </td>
                    <td className="px-6 py-3 text-[var(--muted-foreground)]">
                      {duration(s.started_at, s.completed_at)}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                      {s.user_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
