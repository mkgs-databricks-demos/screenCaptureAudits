import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Input, Textarea } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
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
} from 'lucide-react';

// ---- Step icon mapping ----

const actionIcons: Record<string, React.ReactNode> = {
  click: <MousePointer size={14} />,
  type: <Type size={14} />,
  navigate: <ArrowRight size={14} />,
  screenshot: <Camera size={14} />,
  press_key: <ArrowRight size={14} />,
};

// ---- Step Editor ----

function StepEditor({
  step,
  onChange,
}: {
  step: PatternStep;
  onChange: (updated: PatternStep) => void;
}) {
  return (
    <div className="pl-8 pr-4 py-4 bg-[var(--muted)] rounded-lg space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Label"
          value={step.label}
          onChange={(e) => onChange({ ...step, label: e.target.value })}
          placeholder="Step label"
        />
        <Input
          label="Action"
          value={step.action}
          onChange={(e) => onChange({ ...step, action: e.target.value })}
          placeholder="click, type, navigate, screenshot"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="CSS Selector"
          value={step.selector ?? ''}
          onChange={(e) => onChange({ ...step, selector: e.target.value })}
          placeholder="#element-id or .class-name"
          className="font-mono text-xs"
        />
        <Input
          label="Value"
          value={step.value ?? ''}
          onChange={(e) => onChange({ ...step, value: e.target.value })}
          placeholder="Text to type or URL to navigate"
        />
      </div>
      <Textarea
        label="Description"
        value={step.description ?? ''}
        onChange={(e) => onChange({ ...step, description: e.target.value })}
        placeholder="What this step accomplishes"
        rows={2}
      />
      <Textarea
        label="Auditor Notes"
        value={step.auditor_notes ?? ''}
        onChange={(e) => onChange({ ...step, auditor_notes: e.target.value })}
        placeholder="Guidance for the agent (e.g., fallback instructions, what to check)"
        rows={2}
      />
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={step.screenshot_required ?? false}
            onChange={(e) =>
              onChange({ ...step, screenshot_required: e.target.checked })
            }
            className="rounded border-[var(--border)]"
          />
          Screenshot required at this step
        </label>
      </div>
    </div>
  );
}

// ---- Pattern Card (expanded view) ----

function PatternDetail({
  pattern,
  onClose,
}: {
  pattern: NavigationPattern;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(pattern.description ?? '');
  const [auditPurpose, setAuditPurpose] = useState(pattern.audit_purpose ?? '');
  const [agentInstructions, setAgentInstructions] = useState(
    pattern.agent_instructions ?? ''
  );
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
      await updatePattern(pattern.id, {
        description,
        auditPurpose,
        agentInstructions,
        steps,
        screenSequence: steps
          .filter((s) => s.label)
          .map((s) => s.label),
      });
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete pattern "${pattern.pattern_name}"?`)) return;
    setDeleting(true);
    try {
      await deletePattern(pattern.id);
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{pattern.pattern_name}</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              {pattern.target_system}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success">
              {pattern.success_count} success
            </Badge>
            {pattern.failure_count > 0 && (
              <Badge variant="error">
                {pattern.failure_count} failures
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pattern-level fields */}
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this pattern does and when to use it"
        />
        <Textarea
          label="Audit Purpose"
          value={auditPurpose}
          onChange={(e) => setAuditPurpose(e.target.value)}
          placeholder="Why this pattern exists and what audit requirement it fulfills"
        />
        <Textarea
          label="Agent Instructions"
          value={agentInstructions}
          onChange={(e) => setAgentInstructions(e.target.value)}
          placeholder="Pattern-level instructions for the agent (applies to all steps)"
        />

        {/* Steps timeline */}
        <div>
          <h4 className="text-sm font-medium mb-3">
            Steps ({steps.length})
          </h4>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i}>
                <button
                  onClick={() =>
                    setExpandedStep(expandedStep === i ? null : i)
                  }
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--muted)] transition-colors text-left"
                >
                  <GripVertical
                    size={14}
                    className="text-[var(--muted-foreground)] cursor-grab"
                  />
                  <div className="w-6 h-6 rounded-full bg-[var(--dbx-lava-600)] text-white text-xs flex items-center justify-center font-medium">
                    {step.step_order}
                  </div>
                  <div className="text-[var(--muted-foreground)]">
                    {actionIcons[step.action] ?? <ArrowRight size={14} />}
                  </div>
                  <span className="font-medium text-sm flex-1">{step.label}</span>
                  {step.screenshot_required && (
                    <Camera size={14} className="text-[var(--dbx-lava-600)]" />
                  )}
                  {expandedStep === i ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                {expandedStep === i && (
                  <StepEditor
                    step={step}
                    onChange={(updated) => updateStep(i, updated)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <span className="animate-spin">...</span>
            ) : (
              <Save size={16} />
            )}
            Save Changes
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 size={16} />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Main Patterns Page ----

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

  // Group patterns by target system
  const grouped = patterns.reduce(
    (acc, p) => {
      (acc[p.target_system] ??= []).push(p);
      return acc;
    },
    {} as Record<string, NavigationPattern[]>
  );

  const selectedPattern = patterns.find((p) => p.id === selectedId);

  function handleClose() {
    setSelectedId(null);
    // Refresh patterns list
    listPatterns()
      .then((data) => setPatterns(data.patterns))
      .catch(console.error);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">Navigation Patterns</h1>
      <p className="text-[var(--muted-foreground)] mb-8">
        View and edit learned navigation patterns. Add auditor context, notes,
        and fallback instructions for the agent.
      </p>

      {/* Expanded pattern editor */}
      {selectedPattern && (
        <PatternDetail pattern={selectedPattern} onClose={handleClose} />
      )}

      {/* Pattern list grouped by system */}
      {loading ? (
        <div className="text-center text-[var(--muted-foreground)] py-12">
          Loading...
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState
          icon={<Route size={28} />}
          title="No patterns yet"
          description="Navigation patterns are learned automatically as the agent completes audits. They can also be created manually."
        />
      ) : (
        Object.entries(grouped).map(([system, pats]) => (
          <div key={system} className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Route size={18} className="text-[var(--dbx-lava-600)]" />
              {system}
            </h2>
            <div className="space-y-2">
              {pats.map((p) => (
                <Card
                  key={p.id}
                  className={`cursor-pointer transition-shadow hover:shadow-md ${
                    selectedId === p.id ? 'ring-2 ring-[var(--dbx-lava-600)]' : ''
                  }`}
                >
                  <button
                    onClick={() =>
                      setSelectedId(selectedId === p.id ? null : p.id)
                    }
                    className="w-full text-left px-6 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{p.pattern_name}</span>
                        {p.description && (
                          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                            {p.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                        <span>{p.steps.length} steps</span>
                        <span className="flex items-center gap-1">
                          <Check size={12} className="text-[var(--dbx-success)]" />
                          {p.success_count}
                        </span>
                        {p.auth_method && <Badge>{p.auth_method}</Badge>}
                        {selectedId === p.id ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
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
