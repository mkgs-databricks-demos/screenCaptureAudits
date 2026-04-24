import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { listAudits, type AuditSession } from '@/lib/api';
import {
  ScanSearch,
  ClipboardCheck,
  FileSearch,
  AlertTriangle,
  Plus,
  ArrowRight,
  Monitor,
} from 'lucide-react';

const statConfig = [
  { key: 'active', label: 'Active Audits', icon: FileSearch, color: 'var(--accent-info)', subtle: 'var(--accent-info-subtle)' },
  { key: 'completed', label: 'Completed', icon: ClipboardCheck, color: 'var(--accent-success)', subtle: 'var(--accent-success-subtle)' },
  { key: 'failed', label: 'Failed', icon: AlertTriangle, color: 'var(--accent-error)', subtle: 'var(--accent-error-subtle)' },
  { key: 'systems', label: 'Target Systems', icon: Monitor, color: 'var(--accent-primary)', subtle: 'var(--surface-tertiary)' },
] as const;

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

  const counts = {
    active: sessions.filter((s) => s.status === 'active').length,
    completed: sessions.filter((s) => s.status === 'completed').length,
    failed: sessions.filter((s) => s.status === 'failed').length,
    systems: new Set(sessions.map((s) => s.target_system)).size,
  };

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Hero header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-medium text-[var(--accent-primary)] uppercase tracking-widest mb-1.5">Overview</p>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Dashboard</h1>
          <p className="text-[var(--text-secondary)] mt-1">Audit activity and recent sessions at a glance.</p>
        </div>
        <Button onClick={() => navigate('/audit')} size="lg">
          <Plus size={18} />
          New Audit
        </Button>
      </div>

      {/* Stats grid with stagger animation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-list">
        {statConfig.map(({ key, label, icon: Icon, color, subtle }) => (
          <Card key={key} elevated>
            <CardContent className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: subtle, color }}
              >
                <Icon size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{counts[key]}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent sessions */}
      <Card>
        <div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-primary)]">Recent Audit Sessions</h2>
          {sessions.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
              View all <ArrowRight size={14} />
            </Button>
          )}
        </div>
        {loading ? (
          <div className="px-6 py-12 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-12 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<ScanSearch size={28} />}
            title="No audits yet"
            description="Start your first screen capture audit to see results here."
            action={
              <Button onClick={() => navigate('/audit')}>
                <Plus size={16} /> Start Audit
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface-secondary)] text-left">
                  <th className="px-6 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Target System</th>
                  <th className="px-6 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Audit Type</th>
                  <th className="px-6 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Started</th>
                  <th className="px-6 py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">User</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 10).map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-tertiary)] cursor-pointer transition-colors duration-[var(--motion-fast)]"
                    onClick={() => navigate(s.status === 'active' ? `/audit/${s.id}` : '/history')}
                  >
                    <td className="px-6 py-3 font-medium text-[var(--text-primary)]">{s.target_system}</td>
                    <td className="px-6 py-3 text-[var(--text-secondary)]">{s.audit_type ?? '--'}</td>
                    <td className="px-6 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-6 py-3 text-[var(--text-secondary)]">{formatDate(s.started_at)}</td>
                    <td className="px-6 py-3 font-mono text-xs text-[var(--text-tertiary)]">{s.user_id}</td>
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
