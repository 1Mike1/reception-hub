/**
 * React Query hooks for ElevenLabs API data.
 * All hooks include staleTime and retry settings optimised for the
 * receptionist-hub UX (data freshness vs. API rate limits).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAgents,
  getAgent,
  getConversations,
  getConversationDetails,
  getActiveCallsStats,
  setAgentArchived,
  deleteAgent,
  deleteConversation,
  updateAgentConfig,
  calculateLlmUsage,
  getAuditLogs,
} from '@/services/elevenLabsApi';
import type { ConversationFilters, AgentConfigUpdate, LlmUsageCalculateRequest, AuditLogFilters } from '@/services/elevenLabsApi';

/** Fetch all ElevenLabs agents (= the client list) */
export function useAgents() {
  return useQuery({
    queryKey: ['elevenlabs', 'agents'],
    queryFn: getAgents,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 2,
  });
}

/** Fetch a single ElevenLabs agent by agent_id */
export function useAgent(agentId?: string) {
  return useQuery({
    queryKey: ['elevenlabs', 'agents', agentId],
    queryFn: () => getAgent(agentId!),
    enabled: Boolean(agentId),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch conversations, optionally filtered by agentId.
 * When agentId is omitted all conversations are returned.
 */
export function useConversations(agentId?: string, filters?: Omit<ConversationFilters, 'agent_id' | 'page_size'>) {
  return useQuery({
    queryKey: ['elevenlabs', 'conversations', agentId ?? 'all', filters ?? {}],
    queryFn: () => getConversations(agentId, 50, filters),
    staleTime: 2 * 60 * 1000, // 2 min
    retry: 2,
  });
}

/** Fetch full conversation details (messages + analysis) */
export function useConversationDetails(conversationId?: string) {
  return useQuery({
    queryKey: ['elevenlabs', 'conversations', conversationId, 'details'],
    queryFn: () => getConversationDetails(conversationId!),
    enabled: Boolean(conversationId),
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

/** Fetch active/in-progress calls statistics (refreshes more frequently) */
export function useActiveCallsStats(agentId?: string) {
  return useQuery({
    queryKey: ['elevenlabs', 'active-calls-stats', agentId ?? 'all'],
    queryFn: () => getActiveCallsStats(agentId),
    staleTime: 10 * 1000, // 10 seconds (more frequent for live data)
    refetchInterval: 15 * 1000, // Auto-refresh every 15 seconds
    retry: 2,
  });
}

/** Mutation to archive or unarchive an agent. Invalidates the agents list on success. */
export function useSetAgentArchived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, archived }: { agentId: string; archived: boolean }) =>
      setAgentArchived(agentId, archived),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs', 'agents'] });
    },
  });
}

/** Mutation to permanently delete an agent. Invalidates the agents list on success. */
export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => deleteAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs', 'agents'] });
    },
  });
}

/** Mutation to delete a conversation. Invalidates conversations list on success. */
export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs', 'conversations'] });
    },
  });
}

/** Mutation to update an agent's config (prompt, first_message, language, etc.). */
export function useUpdateAgentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, config }: { agentId: string; config: AgentConfigUpdate }) =>
      updateAgentConfig(agentId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elevenlabs', 'agents'] });
    },
  });
}

/** Query to calculate expected LLM token usage for an agent */
export function useLlmUsageCalculate(agentId?: string, body?: LlmUsageCalculateRequest) {
  return useQuery({
    queryKey: ['elevenlabs', 'llm-usage', agentId, body ?? {}],
    queryFn: () => calculateLlmUsage(agentId!, body),
    enabled: Boolean(agentId),
    staleTime: 10 * 60 * 1000, // 10 min – LLM pricing rarely changes
    retry: 1,
  });
}

/** Fetch audit logs with optional filters */
export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: ['audit-logs', filters ?? {}],
    queryFn: () => getAuditLogs(filters),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
  });
}
