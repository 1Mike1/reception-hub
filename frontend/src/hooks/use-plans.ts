/**
 * React Query hooks for Plans & Payments.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPlanTiers,
  getClientPlan,
  getUsageAlert,
  getAllPlans,
  createCheckoutSession,
  confirmPayment,
} from '@/services/planApi';

/** Fetch all available plan tiers */
export function usePlanTiers() {
  return useQuery({
    queryKey: ['plans', 'tiers'],
    queryFn: getPlanTiers,
    staleTime: 10 * 60 * 1000, // 10 min – tiers rarely change
  });
}

/** Fetch the active plan for a specific client */
export function useClientPlan(clientId?: string) {
  return useQuery({
    queryKey: ['plans', 'client', clientId],
    queryFn: () => getClientPlan(clientId!),
    enabled: Boolean(clientId),
    staleTime: 60 * 1000, // 1 min
  });
}

/** Check 80% usage alert for a client */
export function useUsageAlert(clientId?: string) {
  return useQuery({
    queryKey: ['plans', 'usage-alert', clientId],
    queryFn: () => getUsageAlert(clientId!),
    enabled: Boolean(clientId),
    staleTime: 60 * 1000,
  });
}

/** Admin: fetch all client plans */
export function useAllPlans() {
  return useQuery({
    queryKey: ['plans', 'all'],
    queryFn: getAllPlans,
    staleTime: 60 * 1000,
  });
}

/** Mutation: create a Stripe checkout session */
export function useCreateCheckout() {
  return useMutation({
    mutationFn: ({ clientId, tierId }: { clientId: string; tierId: string }) =>
      createCheckoutSession(clientId, tierId),
  });
}

/** Mutation: confirm a payment and activate plan (supports mock + real Stripe) */
export function useConfirmPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, tierId, clientId }: { sessionId: string; tierId?: string; clientId?: string }) =>
      confirmPayment(sessionId, tierId, clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
