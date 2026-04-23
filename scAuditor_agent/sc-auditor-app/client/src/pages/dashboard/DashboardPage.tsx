import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { listAudits, type AuditSession } from '@/lib/api';
import {
  Camera,
  ClipboardCheck,
  FileSearch,
  AlertTriangle,
  Plus,
} from 'lucide-react';

export function DashboardPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAudits()
      .then((data) => setSessions(data.sessions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const active = sessions.filter((s) => s.status === 'active').length;
  const completed = sessions.filter((s) => s.status === 'completed').length;
  const failed = sessions.filter((s) => s.status === 'failed').length;
  const systems = new Set(sessions.map((s) => s.target_system)).size;

  const stats = [
    { label: 'Active Audits', value: active, icon: <FileSearch size={20} />, color: 'text-[var(--dbx-info)]' },
    { label: 'Completed', value: completed, icon: <ClipboardCheck size={20} />, color: 'text-[var(--dbx-success)]' },
    { label: 'Failed', value: failed, icon: <AlertTriangle size={20} />, color: 'text-[var(--dbx-error)]' },
    { label: 'Target Systems', value: systems, icon: <Camera size={20} />, color: 'text-[var(--dbx-lava-600)]' },
  ];

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Audit overview and recent activity
          </p>
        </div>
        <Button onClick={() => navigate('/audit')}>
          <Plus size={16} />
          New Audit
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4">
              <div className={`${color}`}>{icon}</div>
              <div>
                <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent sessions */}
      <Card>
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-semibold">Recent Audit Sessions</h2>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-[var(--muted-foreground)]">
            Loading...
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<Camera size={28} />}
            title="No audits yet"
            description="Start your first screen capture audit to see results here."
            action={
              <Button onClick={() => navigate('/audit')}>
                <Plus size={16} />
                Start Audit
              </Button>
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
                  <th className="px-6 py-3 font-medium">User</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 15).map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
                    onClick={() =>
                      navigate(s.status === 'active' ? `/audit/${s.id}` : `/history`)
                    }
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
                    <td className="px-6 py-3 text-[var(--muted-foreground)] font-mono text-xs">
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
