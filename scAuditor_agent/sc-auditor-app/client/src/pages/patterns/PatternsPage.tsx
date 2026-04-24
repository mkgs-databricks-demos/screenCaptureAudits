import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Input, Textarea } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
import { BRAND_DIAMOND } from '@/lib/brand';
import {
  listPatterns,
  updatePattern,
  deletePattern,
  type NavigationPattern,
  type PatternStep,
} from '@/lib/api';
import {
  Route,
  ChevronDown,
  ChevronRight,
  Save,
  Trash2,
  GripVertical,
  Camera,
  MousePointer,
  Type,
  ArrowRight,
  Check,
  X,
  Loader2,
} from 'lucide-react';

const actionIcons: Record<string, React.ReactNode> = {
  click: <MousePointer size={14} />,
  type: <Type size={14} />,
  navigate: <ArrowRight size={14} />,
  screenshot: <Camera size={14} />,
  press_key: <ArrowRight size={14} />,
};

function StepEditor({ step, onChange }: { step: PatternStep; onChange: (updated: PatternStep) => void }) {
  return (
    <div className="pl-8 pr-4 py-4 bg-[var(--surface-tertiary)] rounded-xl space-y-3 animate-[slideUp_var(--motion-fast)_var(--ease-out)]">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Label" value={step.label} onChange={(e) => onChange({ ...step, label: e.target.value })} placeholder="Step label" />
        <Input label="Action" value={step.action} onChange={(e) => onChange({ ...step, action: e.target.value })} placeholder="click, type, navigate, screenshot" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="CSS Selector" value={step.selector ?? ''} onChange={(e) => onChange({ ...step, selector: e.target.value })} placeholder="#element-id or .class-name" className="font-mono text-xs" />
        <Input label="Value" value={step.value ?? ''} onChange={(e) => onChange({ ...step, value: e.target.value })} placeholder="Text to type or URL to navigate" />
      </div>
      <Textarea label="Description" value={step.description ?? ''} onChange={(e) => onChange({ ...step, description: e.target.value })} placeholder="What this step accomplishes" rows={2} />
      <Textarea label="Auditor Notes" value={step.auditor_notes ?? ''} onChange={(e) => onChange({ ...step, auditor_notes: e.target.value })} placeholder="Guidance for the agent (e.g., fallback instructions)" rows={2} />
      <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
        <input type="checkbox" checked={step.screenshot_required ?? false} onChange={(e) => onChange({ ...step, screenshot_required: e.target.checked })} className="rounded border-[var(--border-default)] accent-[var(--accent-primary)]" />
        Screenshot required at this step
      </label>
    </div>
  );
}

function PatternDetail({ pattern, onClose }: { pattern: NavigationPattern; onClose: () => void }) {
  const [description, setDescription] = useState(pattern.description ?? '');
  const [auditPurpose, setAuditPurpose] = useState(pattern.audit_purpose ?? '');
  const [agentInstructions, setAgentInstructions] = useState(pattern.agent_instructions ?? '');
  const [steps, setSteps] = useState<PatternStep[]>(pattern.steps);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function updateStep(index: number, updated: PatternStep) {
    setSteps((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updatePattern(pattern.id, { description, auditPurpose, agentInstructions, steps, screenSequence: steps.filter((s) => s.label).map((s) => s.label) });
    } catch (err) { console.error('Save failed:', err); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete pattern "${pattern.pattern_name}"?`)) return;
    setDeleting(true);
    try { await deletePattern(pattern.id); onClose(); }
    catch (err) { console.error('Delete failed:', err); }
    finally { setDeleting(false); }
  }

  return (
    <Card className="mb-6 animate-[scaleIn_var(--motion-moderate)_var(--ease-out)]" elevated>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg text-[var(--text-primary)]">{pattern.pattern_name}</h3>
            <p className="text-sm text-[var(--text-secondary)]">{pattern.target_system}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success">{pattern.success_count} success</Badge>
            {pattern.failure_count > 0 && <Badge variant="error">{pattern.failure_count} failures</Badge>}
            <Button variant="ghost" size="sm" onClick={onClose}><X size={16} /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this pattern does and when to use it" />
        <Textarea label="Audit Purpose" value={auditPurpose} onChange={(e) => setAuditPurpose(e.target.value)} placeholder="Why this pattern exists and what audit requirement it fulfills" />
        <Textarea label="Agent Instructions" value={agentInstructions} onChange={(e) => setAgentInstructions(e.target.value)} placeholder="Pattern-level instructions for the agent" />

        {/* Steps timeline */}
        <div>
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">Steps ({steps.length})</h4>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i}>
                <button
                  onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--surface-tertiary)] transition-colors duration-[var(--motion-fast)] text-left"
                >
                  <GripVertical size={14} className="text-[var(--text-tertiary)] cursor-grab" />
                  <div className="w-7 h-7 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center font-bold shadow-sm">
                    {step.step_order}
                  </div>
                  <div className="text-[var(--text-tertiary)]">{actionIcons[step.action] ?? <ArrowRight size={14} />}</div>
                  <span className="font-medium text-sm flex-1 text-[var(--text-primary)]">{step.label}</span>
                  {step.screenshot_required && <Camera size={14} className="text-[var(--accent-primary)]" />}
                  {expandedStep === i ? <ChevronDown size={14} className="text-[var(--text-tertiary)]" /> : <ChevronRight size={14} className="text-[var(--text-tertiary)]" />}
                </button>
                {expandedStep === i && <StepEditor step={step} onChange={(updated) => updateStep(i, updated)} />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-[var(--border-default)]">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Changes
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            <Trash2 size={16} /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PatternsPage() {
  const [patterns, setPatterns] = useState<NavigationPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    listPatterns()
      .then((data) => setPatterns(data.patterns))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const grouped = patterns.reduce(
    (acc, p) => { (acc[p.target_system] ??= []).push(p); return acc; },
    {} as Record<string, NavigationPattern[]>
  );

  const selectedPattern = patterns.find((p) => p.id === selectedId);

  function handleClose() {
    setSelectedId(null);
    listPatterns().then((data) => setPatterns(data.patterns)).catch(console.error);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-1">
        <img src={BRAND_DIAMOND} alt="Databricks" className="w-10 h-10 opacity-90 drop-shadow-sm" />
        <div>
          <p className="text-xs font-medium text-[var(--accent-primary)] uppercase tracking-widest mb-1">Configuration</p>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight leading-[1.2]">Navigation Patterns</h1>
        </div>
      </div>
      <p className="text-[var(--text-secondary)] mb-8 ml-14">
        View and edit learned navigation patterns. Add auditor context, notes, and fallback instructions.
      </p>

      {selectedPattern && <PatternDetail pattern={selectedPattern} onClose={handleClose} />}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState
          icon={<Route size={28} />}
          title="No patterns yet"
          description="Navigation patterns are learned automatically as the agent completes audits."
        />
      ) : (
        Object.entries(grouped).map(([system, pats]) => (
          <div key={system} className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Route size={18} className="text-[var(--accent-primary)]" />
              {system}
            </h2>
            <div className="space-y-2 stagger-list">
              {pats.map((p) => (
                <Card
                  key={p.id}
                  className={`cursor-pointer transition-all duration-[var(--motion-fast)] hover:shadow-md ${
                    selectedId === p.id ? 'ring-2 ring-[var(--accent-primary)] shadow-md' : ''
                  }`}
                >
                  <button onClick={() => setSelectedId(selectedId === p.id ? null : p.id)} className="w-full text-left px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">{p.pattern_name}</span>
                        {p.description && <p className="text-sm text-[var(--text-secondary)] mt-0.5">{p.description}</p>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                        <span>{p.steps.length} steps</span>
                        <span className="flex items-center gap-1">
                          <Check size={12} className="text-[var(--accent-success)]" /> {p.success_count}
                        </span>
                        {p.auth_method && <Badge>{p.auth_method}</Badge>}
                        {selectedId === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    </div>
                  </button>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
