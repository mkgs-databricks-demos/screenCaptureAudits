/**
 * Shared types between server and client.
 * Add types here that both sides of the app need to reference.
 */

export interface AuditSession {
  id: string;
  userId: string;
  targetSystem: string;
  targetUrl?: string;
  auditType?: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
}

export interface AgentMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: unknown;
  toolResults?: unknown;
  createdAt: string;
}
