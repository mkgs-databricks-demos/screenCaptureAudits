import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Input';
import { Card, CardContent } from '@/components/Card';
import { StatusBadge } from '@/components/Badge';
import {
  createAudit,
  sendMessage,
  getMessages,
  type AgentMessage,
  type ChatResponse,
} from '@/lib/api';
import {
  Send,
  Camera,
  Loader2,
  Bot,
  User,
  Wrench,
  ImageIcon,
} from 'lucide-react';

// ---- New Audit Form ----

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
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">New Audit</h1>
      <p className="text-[var(--muted-foreground)] mb-8">
        Configure the target system and start an automated audit session.
      </p>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Target System"
              placeholder="e.g., Epic Claims, SAP Finance, demo-login-site"
              value={targetSystem}
              onChange={(e) => setTargetSystem(e.target.value)}
              required
            />
            <Input
              label="Target URL"
              placeholder="https://..."
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
            />
            <Select
              label="Audit Type"
              value={auditType}
              onChange={(e) => setAuditType(e.target.value)}
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
            <div className="pt-2">
              <Button type="submit" disabled={creating || !targetSystem.trim()}>
                {creating && <Loader2 size={16} className="animate-spin" />}
                {creating ? 'Creating...' : 'Start Audit'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Screenshot Viewer ----

function ScreenshotViewer({ screenshots }: { screenshots: string[] }) {
  const latest = screenshots.length > 0 ? screenshots[screenshots.length - 1] : null;

  if (!latest) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--muted)] rounded-lg">
        <div className="text-center text-[var(--muted-foreground)]">
          <ImageIcon size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Screenshots will appear here as the agent captures them</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-2">
      <div className="flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center">
        <img
          src={`data:image/png;base64,${latest}`}
          alt="Latest screenshot"
          className="max-w-full max-h-full object-contain"
        />
      </div>
      {screenshots.length > 1 && (
        <div className="flex gap-1 overflow-x-auto py-1">
          {screenshots.map((s, i) => (
            <img
              key={i}
              src={`data:image/png;base64,${s}`}
              alt={`Screenshot ${i + 1}`}
              className="h-12 w-20 object-cover rounded border border-[var(--border)] opacity-60 hover:opacity-100 cursor-pointer transition-opacity"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Chat Panel ----

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

    // Optimistically add user message
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
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-[var(--muted-foreground)] text-sm py-8">
            <Bot size={32} className="mx-auto mb-2 opacity-40" />
            <p>Send a message to start the audit agent.</p>
            <p className="text-xs mt-1 opacity-70">
              Try: "Navigate to the target system and log in"
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role !== 'user' && (
              <div className="w-7 h-7 rounded-full bg-[var(--dbx-lava-600)] flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-[var(--dbx-navy-800)] text-white'
                  : 'bg-[var(--muted)]'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {Array.isArray(msg.tool_calls) && (
                <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1">
                  {(msg.tool_calls as Array<{ name: string }>).map((tc, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/10 text-xs font-mono"
                    >
                      <Wrench size={10} />
                      {tc.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-[var(--dbx-navy-800)] flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-white" />
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[var(--dbx-lava-600)] flex items-center justify-center">
              <Loader2 size={14} className="text-white animate-spin" />
            </div>
            <div className="bg-[var(--muted)] rounded-xl px-4 py-2.5 text-sm text-[var(--muted-foreground)]">
              Agent is working...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-[var(--border)]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell the agent what to audit..."
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--dbx-lava-600)]"
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

// ---- Main Audit Page ----

export function AuditPage() {
  const { sessionId: routeSessionId } = useParams();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(routeSessionId ?? null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [screenshots, setScreenshots] = useState<string[]>([]);

  // Load existing messages if resuming a session
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

  function handleNewMessage(
    msg: AgentMessage,
    toolCalls: ChatResponse['toolCallsMade']
  ) {
    setMessages((prev) => [...prev, msg]);

    // Extract screenshots from tool calls
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-3">
          <Camera size={16} className="text-[var(--dbx-lava-600)]" />
          <span className="text-sm font-medium">Session: </span>
          <code className="text-xs font-mono text-[var(--muted-foreground)]">
            {sessionId}
          </code>
          <StatusBadge status="active" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted-foreground)]">
            {screenshots.length} screenshots
          </span>
        </div>
      </div>

      {/* Split pane */}
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={60} minSize={30}>
          <div className="h-full p-4 flex flex-col">
            <ScreenshotViewer screenshots={screenshots} />
          </div>
        </Panel>

        <PanelResizeHandle className="w-2 bg-[var(--border)] hover:bg-[var(--dbx-lava-600)] transition-colors flex items-center justify-center">
          <div className="w-0.5 h-8 rounded-full bg-[var(--muted-foreground)] opacity-50" />
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
