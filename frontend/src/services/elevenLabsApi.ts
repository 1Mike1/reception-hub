/**
 * ElevenLabs API Service Layer
 * Calls the FastAPI backend which proxies ElevenLabs API requests.
 * Backend base URL defaults to http://localhost:8000 and can be
 * overridden via the VITE_BACKEND_URL environment variable.
 */

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) ?? 'http://localhost:8000';

// ─── Raw ElevenLabs types (as returned by the backend) ───────────────────────

export interface ELAgent {
  agent_id: string;
  name: string;
  tags?: string[];
  /** Unix epoch seconds */
  created_at_unix_secs?: number;
  last_call_time_unix_secs?: number;
  last_7_day_call_count?: number;
  /** true = agent is archived/inactive */
  archived?: boolean;
  access_info?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** Full agent config (returned by single-agent detail endpoint) */
  conversation_config?: {
    agent?: {
      prompt?: { prompt?: string };
      first_message?: string;
      language?: string;
    };
    tts?: {
      voice_id?: string;
      model_id?: string;
    };
    conversation?: {
      max_duration_seconds?: number;
    };
  };
  platform_settings?: {
    archived?: boolean;
    call_limits?: {
      agent_concurrency_limit?: number;
      daily_limit?: number;
    };
    privacy?: {
      record_voice?: boolean;
      retention_days?: number;
    };
  };
  // Allow any extra fields returned by the single-agent detail endpoint
  [key: string]: unknown;
}

/** Filter parameters supported by the ElevenLabs conversations list endpoint */
export interface ConversationFilters {
  agent_id?: string;
  page_size?: number;
  summary_mode?: string;
  call_successful?: 'success' | 'failure' | 'unknown';
  call_start_after_unix?: number;
  call_start_before_unix?: number;
  call_duration_min_secs?: number;
  call_duration_max_secs?: number;
  rating_min?: number;
  rating_max?: number;
  direction?: 'inbound' | 'outbound';
}

export interface ELConversation {
  conversation_id: string;
  agent_id: string;
  agent_name?: string;
  /** Real ElevenLabs field name (Unix epoch seconds) */
  start_time_unix_secs?: number;
  /** Alias kept for backward compat */
  start_time?: number;
  call_duration_secs?: number;
  message_count?: number;
  status: string;
  /** Real API value: 'success' | 'failure' */
  call_successful?: string;
  /** Real API summary field from list endpoint */
  transcript_summary?: string;
  call_summary_title?: string;
  /** Summary field from details endpoint (may be string or object) */
  summary?: string | { summary?: string; summary_base_64_encoded?: string };
  has_audio?: boolean;
  created_at?: string;
  updated_at?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ELConversationMessage {
  role: 'agent' | 'user';
  message: string;
  time_in_call_secs?: number;
}

export interface ELConversationDetails extends ELConversation {
  messages?: ELConversationMessage[];
  transcript?: ELConversationMessage[];
  analysis?: {
    call_successful?: string;
    transcript_summary?: string;
    data_collection_results?: Record<string, unknown>;
  };
}

/** Export BACKEND_URL so components can use it as audio src directly */
export { BACKEND_URL };

// ─── Internal fetch helper ───────────────────────────────────────────────────

async function fetchBackend<T>(path: string): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Normalise the response to an array regardless of whether ElevenLabs
 * wraps it in { agents: [] } / { conversations: [] } or returns a bare list.
 */
function toArray<T>(
  data: T[] | { agents?: T[] } | { conversations?: T[] } | unknown,
): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj['agents'])) return obj['agents'] as T[];
    if (Array.isArray(obj['conversations'])) return obj['conversations'] as T[];
  }
  return [];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract a plain-text summary from all possible locations in the response */
export function extractSummary(
  raw?: ELConversation['summary'] | null,
  conv?: Partial<ELConversation>,
  details?: Partial<ELConversationDetails>,
): string {
  // 1. details.analysis.transcript_summary (single-conversation endpoint)
  if (details?.analysis?.transcript_summary) return details.analysis.transcript_summary;
  // 2. details.summary
  if (details?.summary) {
    if (typeof details.summary === 'string') return details.summary;
    if ((details.summary as { summary?: string }).summary) return (details.summary as { summary?: string }).summary!;
  }
  // 3. conv.transcript_summary (list endpoint)
  if (conv?.transcript_summary) return conv.transcript_summary;
  // 4. raw summary argument
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  return raw.summary ?? '';
}

/** Convert start_time_unix_secs (or start_time / created_at fallbacks) to ISO string */
export function toISOTimestamp(conv: ELConversation): string {
  if (conv.start_time_unix_secs) return new Date(conv.start_time_unix_secs * 1000).toISOString();
  if (conv.start_time) return new Date(conv.start_time * 1000).toISOString();
  if (conv.created_at) return conv.created_at;
  return new Date().toISOString();
}

// ─── Public API functions ─────────────────────────────────────────────────────

/** GET /agents → array of ElevenLabs agents */
export async function getAgents(): Promise<ELAgent[]> {
  const data = await fetchBackend<unknown>('/agents');
  return toArray<ELAgent>(data);
}

/** GET /agents/:agentId → single agent */
export async function getAgent(agentId: string): Promise<ELAgent> {
  return fetchBackend<ELAgent>(`/agents/${agentId}`);
}

/**
 * GET /conversations → list of conversations.
 * Pass agentId to filter by a specific ElevenLabs agent.
 * Pass additional ConversationFilters to refine results.
 */
export async function getConversations(
  agentId?: string,
  pageSize = 50,
  filters?: Omit<ConversationFilters, 'agent_id' | 'page_size'>,
): Promise<ELConversation[]> {
  const params = new URLSearchParams();
  if (agentId) params.set('agent_id', agentId);
  params.set('page_size', String(pageSize));
  params.set('summary_mode', 'include');
  if (filters) {
    (Object.keys(filters) as Array<keyof typeof filters>).forEach((key) => {
      const val = filters[key];
      if (val !== undefined && val !== null) params.set(key, String(val));
    });
  }
  const data = await fetchBackend<unknown>(`/conversations?${params.toString()}`);
  return toArray<ELConversation>(data);
}

/** GET /conversations/:id → full conversation details with messages */
export async function getConversationDetails(
  conversationId: string,
): Promise<ELConversationDetails> {
  return fetchBackend<ELConversationDetails>(`/conversations/${conversationId}`);
}

/** Active call summary */
export interface ActiveCallSummary {
  conversation_id: string;
  agent_id: string;
  agent_name?: string;
  status: string;
  start_time_unix_secs: number;
  duration_so_far: number;
}

/** Active calls statistics response */
export interface ActiveCallsStats {
  active_count: number;
  in_progress_calls: ActiveCallSummary[];
}

/** GET /conversations/stats/active → get active/in-progress calls stats */
export async function getActiveCallsStats(agentId?: string): Promise<ActiveCallsStats> {
  const params = new URLSearchParams();
  if (agentId) params.set('agent_id', agentId);
  return fetchBackend<ActiveCallsStats>(`/conversations/stats/active?${params.toString()}`);
}

/** DELETE /conversations/:id → delete a conversation */
export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
  }
}

/** PATCH /agents/:agentId/archive → set agent archived=true or archived=false */
export async function setAgentArchived(agentId: string, archived: boolean): Promise<ELAgent> {
  const response = await fetch(`${BACKEND_URL}/agents/${agentId}/archive`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archived }),
  });
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<ELAgent>;
}

/** DELETE /agents/:agentId → permanently delete an agent */
export async function deleteAgent(agentId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/agents/${agentId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
  }
}

/** LLM usage calculate request body */
export interface LlmUsageCalculateRequest {
  prompt_length?: number;
  number_of_pages?: number;
  rag_enabled?: boolean;
}

/** Single LLM price entry */
export interface LlmPriceItem {
  llm: string;
  price_per_minute: number;
}

/** LLM usage calculate response */
export interface LlmUsageCalculateResponse {
  llm_prices: LlmPriceItem[];
}

/** POST /agents/:agentId/llm-usage/calculate → calculate expected LLM token usage */
export async function calculateLlmUsage(
  agentId: string,
  body: LlmUsageCalculateRequest = {},
): Promise<LlmUsageCalculateResponse> {
  const response = await fetch(`${BACKEND_URL}/agents/${agentId}/llm-usage/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<LlmUsageCalculateResponse>;
}

/** Fields that can be updated via PATCH /agents/:agentId/config */
export interface AgentConfigUpdate {
  name?: string;
  prompt?: string;
  first_message?: string;
  language?: string;
  max_duration_seconds?: number;
}

/** PATCH /agents/:agentId/config → update agent conversation config */
export async function updateAgentConfig(agentId: string, config: AgentConfigUpdate): Promise<ELAgent> {
  const response = await fetch(`${BACKEND_URL}/agents/${agentId}/config`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<ELAgent>;
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  admin_id: string;
  admin_email: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string;
  ip_address: string;
  details: {
    previous_value?: any;
    new_value?: any;
    reason?: string;
  };
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditLogFilters {
  action?: string;
  entity_type?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

/** GET /audit-logs → fetch audit logs with optional filters */
export async function getAuditLogs(filters?: AuditLogFilters): Promise<AuditLogsResponse> {
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.page_size) params.set('page_size', String(filters.page_size));
  if (filters?.action && filters.action !== 'all') params.set('action', filters.action);
  if (filters?.entity_type && filters.entity_type !== 'all') params.set('entity_type', filters.entity_type);
  if (filters?.search) params.set('search', filters.search);
  return fetchBackend<AuditLogsResponse>(`/audit-logs?${params.toString()}`);
}
