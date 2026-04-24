import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Input';
import { Card, CardContent } from '@/components/Card';
import { StatusBadge } from '@/components/Badge';
import { ICON_AGENT_BRICKS, BRAND_DIAMOND } from '@/lib/brand';
import {
  createAudit,
  sendMessage,
  getMessages,
  type AgentMessage,
  type ChatResponse,
} from '@/lib/api';
import {
  Send,
  ScanSearch,
  Loader2,
  User,
  Wrench,
  ImageIcon,
  Server,
  Globe,
  ClipboardList,
  Shield,
  FileBarChart,
  CircleDollarSign,
  Cog,
} from 'lucide-react';

// ── Audit Type Icons ──

const AUDIT_TYPE_ICONS: Record<string, React.ReactNode> = {
  claims: <FileBarChart size={14} className="text-[var(--accent-primary)]" />,
  compliance: <Shield size={14} className="text-[var(--accent-info)]" />,
  security: <Shield size={14} className="text-[var(--accent-warning)]" />,
  data_quality: <ScanSearch size={14} className="text-[var(--accent-success)]" />,
  financial: <CircleDollarSign size={14} className="text-[var(--accent-primary)]" />,
  custom: <Cog size={14} className="text-[var(--text-tertiary)]" />,
};

// ── New Audit Form ──

function NewAuditForm({ onCreated }: { onCreated: (sessionId: string) => void }) {
  const [targetSystem, setTargetSystem] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [auditType, setAuditType] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetSystem.trim()) return;
    setCreating(true);
    try {
      const result = await createAudit({
        targetSystem: targetSystem.trim(),
        targetUrl: targetUrl.trim() || undefined,
        auditType: auditType.trim() || undefined,
      });
      onCreated(result.sessionId);
    } catch (err) {
      console.error('Failed to create audit:', err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 animate-[fadeIn_var(--motion-normal)_var(--ease-out)]">
      <div className="flex items-center gap-3 mb-1.5">
        <img
          src={BRAND_DIAMOND}
          alt=""
          className="w-10 h-10 opacity-90 drop-shadow-sm"
        />
        <div>
          <p className="text-xs font-medium text-[var(--accent-primary)] uppercase tracking-widest mb-0.5">New Session</p>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">New Audit</h1>
        </div>
      </div>
      <p className="text-[var(--text-secondary)] mb-8 ml-[52px]">
        Configure the target system and start an automated audit session.
      </p>

      <Card elevated>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Target System"
              placeholder="e.g., Epic Claims, SAP Finance, demo-login-site"
              value={targetSystem}
              onChange={(e) => setTargetSystem(e.target.value)}
              icon={<Server size={16} />}
              required
            />
            <Input
              label="Target URL"
              placeholder="https://..."
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              icon={<Globe size={16} />}
            />
            <Select
              label="Audit Type"
              value={auditType}
              onChange={(e) => setAuditType(e.target.value)}
              icon={<ClipboardList size={16} />}
              options={[
                { value: '', label: 'Select audit type...' },
                { value: 'claims', label: 'Claims Audit' },
                { value: 'compliance', label: 'Compliance Review' },
                { value: 'security', label: 'Security Assessment' },
                { value: 'data_quality', label: 'Data Quality Check' },
                { value: 'financial', label: 'Financial Audit' },
                { value: 'custom', label: 'Custom' },
              ]}
            />

            {/* Audit type hint */}
            {auditType && AUDIT_TYPE_ICONS[auditType] && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-tertiary)] border border-[var(--border-subtle)] animate-[fadeIn_var(--motion-fast)_var(--ease-out)]">
                {AUDIT_TYPE_ICONS[auditType]}
                <span className="text-xs text-[var(--text-secondary)]">
                  {auditType === 'claims' && 'Reviews claim submissions, adjudication logic, and payment accuracy'}
                  {auditType === 'compliance' && 'Checks regulatory adherence, access controls, and audit trails'}
                  {auditType === 'security' && 'Assesses authentication, authorization, and data exposure risks'}
                  {auditType === 'data_quality' && 'Validates data completeness, consistency, and transformation correctness'}
                  {auditType === 'financial' && 'Examines transaction records, reconciliation, and financial controls'}
                  {auditType === 'custom' && 'Flexible audit — describe what to check in the chat'}
                </span>
              </div>
            )}

            <div className="pt-2">
              <Button type="submit" disabled={creating || !targetSystem.trim()} size="lg">
                {creating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ScanSearch size={16} />
                )}
                {creating ? 'Creating...' : 'Start Audit'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Screenshot Viewer ──

function ScreenshotViewer({ screenshots }: { screenshots: string[] }) {
  const latest = screenshots.length > 0 ? screenshots[screenshots.length - 1] : null;

  if (!latest) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--surface-tertiary)] rounded-xl border border-dashed border-[var(--border-default)]">
        <div className="text-center text-[var(--text-tertiary)]">
          <ImageIcon size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Screenshots will appear here</p>
          <p className="text-xs mt-1 text-[var(--text-tertiary)]">as the agent captures them</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-2">
      <div className="flex-1 bg-black/90 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
        <img
          src={`data:image/png;base64,${latest}`}
          alt="Latest screenshot"
          className="max-w-full max-h-full object-contain"
        />
      </div>
      {screenshots.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto py-1">
          {screenshots.map((s, i) => (
            <img
              key={i}
              src={`data:image/png;base64,${s}`}
              alt={`Screenshot ${i + 1}`}
              className="h-14 w-22 object-cover rounded-lg border-2 border-[var(--border-default)] opacity-60 hover:opacity-100 hover:border-[var(--accent-primary)] cursor-pointer transition-all duration-[var(--motion-fast)]"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chat Panel ──

function ChatPanel({
  sessionId,
  messages,
  onNewMessage,
}: {
  sessionId: string;
  messages: AgentMessage[];
  onNewMessage: (msg: AgentMessage, toolCalls: ChatResponse['toolCallsMade']) => void;
}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    const userMsg: AgentMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      tool_calls: null,
      tool_results: null,
      created_at: new Date().toISOString(),
    };
    onNewMessage(userMsg, []);

    try {
      const resp = await sendMessage(sessionId, text);
      const assistantMsg: AgentMessage = {
        id: `temp-${Date.now()}-reply`,
        role: 'assistant',
        content: resp.response,
        tool_calls: resp.toolCallsMade.length > 0 ? resp.toolCallsMade : null,
        tool_results: null,
        created_at: new Date().toISOString(),
      };
      onNewMessage(assistantMsg, resp.toolCallsMade);
    } catch (err) {
      const errorMsg: AgentMessage = {
        id: `temp-${Date.now()}-error`,
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to send message'}`,
        tool_calls: null,
        tool_results: null,
        created_at: new Date().toISOString(),
      };
      onNewMessage(errorMsg, []);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--surface-secondary)]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 animate-[fadeIn_var(--motion-normal)_var(--ease-out)]">
            <div className="w-16 h-16 rounded-2xl bg-[var(--surface-tertiary)] flex items-center justify-center mx-auto mb-4 shadow-sm">
              <img src={BRAND_DIAMOND} alt="Databricks" className="w-10 h-10" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Ready to audit</p>
            <p className="text-xs text-[var(--text-tertiary)] max-w-[200px] mx-auto">
              Tell the agent what system to audit and how to navigate it.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''} animate-[slideUp_var(--motion-fast)_var(--ease-out)]`}>
            {msg.role !== 'user' && (
              <div className="w-7 h-7 rounded-full bg-[var(--surface-tertiary)] flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                <img src={ICON_AGENT_BRICKS} alt="Agent" className="w-5 h-5" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-[var(--surface-nav)] text-white rounded-br-md'
                  : 'bg-[var(--surface-raised)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {Array.isArray(msg.tool_calls) && (
                <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1">
                  {(msg.tool_calls as Array<{ name: string }>).map((tc, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-info-subtle)] text-[var(--accent-info)] text-xs font-mono"
                    >
                      <Wrench size={10} />
                      {tc.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-[var(--surface-nav)] flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-white" />
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex gap-3 animate-[slideUp_var(--motion-fast)_var(--ease-out)]">
            <div className="w-7 h-7 rounded-full bg-[var(--surface-tertiary)] flex items-center justify-center overflow-hidden">
              <Loader2 size={14} className="text-[var(--accent-primary)] animate-spin" />
            </div>
            <div className="bg-[var(--surface-raised)] border border-[var(--border-default)] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-[var(--text-secondary)]">
              Agent is working...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-[var(--border-default)] bg-[var(--surface-raised)]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell the agent what to audit..."
            className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent transition-all duration-[var(--motion-fast)]"
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !input.trim()} size="md">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Main Audit Page ──

export function AuditPage() {
  const { sessionId: routeSessionId } = useParams();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(routeSessionId ?? null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);

  useEffect(() => {
    if (sessionId) {
      getMessages(sessionId)
        .then((data) => setMessages(data.messages))
        .catch(console.error);
    }
  }, [sessionId]);

  function handleCreated(id: string) {
    setSessionId(id);
    navigate(`/audit/${id}`, { replace: true });
  }

  function handleNewMessage(msg: AgentMessage, toolCalls: ChatResponse['toolCallsMade']) {
    setMessages((prev) => [...prev, msg]);
    for (const tc of toolCalls) {
      if (tc.name === 'take_screenshot') {
        const args = tc.arguments as { screenshot_base64?: string };
        if (args.screenshot_base64) {
          setScreenshots((prev) => [...prev, args.screenshot_base64!]);
        }
      }
    }
  }

  if (!sessionId) {
    return <NewAuditForm onCreated={handleCreated} />;
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Session header */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--border-default)] bg-[var(--surface-raised)]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
            <ScanSearch size={12} className="text-white" />
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)]">Session</span>
          <code className="text-xs font-mono text-[var(--text-tertiary)] bg-[var(--surface-tertiary)] px-2 py-0.5 rounded-md">
            {sessionId.slice(0, 12)}...
          </code>
          <StatusBadge status="active" />
        </div>
        <span className="text-xs text-[var(--text-tertiary)] font-medium">
          {screenshots.length} screenshots
        </span>
      </div>

      {/* Split pane */}
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={60} minSize={30}>
          <div className="h-full p-4 flex flex-col bg-[var(--surface-primary)]">
            <ScreenshotViewer screenshots={screenshots} />
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-[var(--border-default)] hover:bg-[var(--accent-primary)] transition-colors duration-[var(--motion-fast)] flex items-center justify-center">
          <div className="w-0.5 h-8 rounded-full bg-[var(--text-tertiary)] opacity-40" />
        </PanelResizeHandle>

        <Panel defaultSize={40} minSize={25}>
          <ChatPanel
            sessionId={sessionId}
            messages={messages}
            onNewMessage={handleNewMessage}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
