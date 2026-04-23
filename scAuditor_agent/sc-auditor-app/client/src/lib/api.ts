/**
 * API client for the SC Auditor backend.
 */

const BASE = '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---- Audit sessions ----

export interface AuditSession {
  id: string;
  user_id: string;
  status: string;
  target_system: string;
  target_url: string | null;
  audit_type: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  context: Record<string, unknown>;
}

export function listAudits(params?: { status?: string; targetSystem?: string }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.targetSystem) qs.set('targetSystem', params.targetSystem);
  const q = qs.toString();
  return request<{ sessions: AuditSession[] }>(`/api/audits${q ? `?${q}` : ''}`);
}

export function getAudit(sessionId: string) {
  return request<AuditSession>(`/api/audits/${sessionId}`);
}

export function createAudit(data: {
  targetSystem: string;
  targetUrl?: string;
  auditType?: string;
  auditLabel?: string;
}) {
  return request<{ sessionId: string; status: string; startedAt: string }>(
    '/api/audits',
    { method: 'POST', body: JSON.stringify(data) }
  );
}

export function updateAuditStatus(sessionId: string, status: string) {
  return request<{ updated: boolean }>(`/api/audits/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ---- Agent chat ----

export interface ChatResponse {
  response: string;
  toolCallsMade: { name: string; arguments: Record<string, unknown> }[];
}

export interface AgentMessage {
  id: string;
  role: string;
  content: string;
  tool_calls: unknown | null;
  tool_results: unknown | null;
  created_at: string;
}

export function sendMessage(sessionId: string, message: string) {
  return request<ChatResponse>(`/api/agent/${sessionId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function getMessages(sessionId: string) {
  return request<{ messages: AgentMessage[] }>(`/api/agent/${sessionId}/messages`);
}

export function closeAgent(sessionId: string) {
  return request<{ closed: boolean }>(`/api/agent/${sessionId}/close`, {
    method: 'POST',
  });
}

// ---- Patterns ----

export interface NavigationPattern {
  id: string;
  target_system: string;
  pattern_name: string;
  description: string | null;
  audit_purpose: string | null;
  agent_instructions: string | null;
  steps: PatternStep[];
  screen_sequence: string[];
  auth_method: string | null;
  success_count: number;
  failure_count: number;
  last_used_at: string | null;
  last_edited_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface PatternStep {
  step_order: number;
  action: string;
  selector?: string;
  value?: string;
  label: string;
  description?: string;
  auditor_notes?: string;
  expected_elements?: string[];
  screenshot_required?: boolean;
  alt_actions?: { action: string; selector: string; notes?: string }[];
}

export function listPatterns(targetSystem?: string) {
  const qs = targetSystem ? `?targetSystem=${encodeURIComponent(targetSystem)}` : '';
  return request<{ patterns: NavigationPattern[] }>(`/api/patterns${qs}`);
}

export function getPattern(patternId: string) {
  return request<NavigationPattern>(`/api/patterns/${patternId}`);
}

export function updatePattern(
  patternId: string,
  data: Partial<{
    description: string;
    auditPurpose: string;
    agentInstructions: string;
    steps: PatternStep[];
    screenSequence: string[];
  }>
) {
  return request<{ updated: boolean }>(`/api/patterns/${patternId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deletePattern(patternId: string) {
  return request<{ deleted: boolean }>(`/api/patterns/${patternId}`, {
    method: 'DELETE',
  });
}

// ---- Credentials ----

export interface CredentialReference {
  id: string;
  user_id: string | null;
  target_system: string;
  credential_source: 'secret_scope' | 'uc_connection';
  secret_scope: string | null;
  username_key: string | null;
  password_key: string | null;
  uc_connection_name: string | null;
  auth_method: string;
  mfa_method: string | null;
  login_url: string | null;
  token_url: string | null;
  scopes: string | null;
  is_admin_managed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function listCredentials() {
  return request<{ credentials: CredentialReference[] }>('/api/credentials');
}

export function createCredential(data: {
  targetSystem: string;
  credentialSource: 'secret_scope' | 'uc_connection';
  secretScope?: string;
  usernameKey?: string;
  passwordKey?: string;
  ucConnectionName?: string;
  authMethod: string;
  mfaMethod?: string;
  loginUrl?: string;
  tokenUrl?: string;
  scopes?: string;
  isAdminManaged?: boolean;
}) {
  return request<{ id: string; created: boolean }>('/api/credentials', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCredential(
  credentialId: string,
  data: Partial<{
    authMethod: string;
    mfaMethod: string;
    loginUrl: string;
    tokenUrl: string;
    scopes: string;
    secretScope: string;
    usernameKey: string;
    passwordKey: string;
    ucConnectionName: string;
  }>
) {
  return request<{ updated: boolean }>(`/api/credentials/${credentialId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCredential(credentialId: string) {
  return request<{ deleted: boolean }>(`/api/credentials/${credentialId}`, {
    method: 'DELETE',
  });
}
