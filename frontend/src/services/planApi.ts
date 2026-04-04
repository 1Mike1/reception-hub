/**
 * Plan & Payment API Service
 * Calls the FastAPI backend for plan tiers, client plans, usage, and Stripe checkout.
 */

import { BACKEND_URL } from './elevenLabsApi';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlanTier {
  tier_id: string;
  name: string;
  tokens: number;
  price_cents: number;
  description: string;
}

export interface ClientPlan {
  id: string;
  client_id: string;
  client_email: string;
  company_name: string;
  tier_id: string;
  tier_name: string;
  total_tokens: number;
  used_tokens: number;
  remaining_tokens: number;
  usage_percent: number;
  alert_triggered: boolean;
  status: string;
  stripe_payment_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UsageAlert {
  alert: boolean;
  usage_percent: number;
  used_tokens: number;
  total_tokens: number;
  message: string;
}

export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
}

// ─── API Functions ───────────────────────────────────────────────────────────

export async function getPlanTiers(): Promise<PlanTier[]> {
  const res = await fetch(`${BACKEND_URL}/plans/tiers`);
  if (!res.ok) throw new Error(`Failed to fetch plan tiers: ${res.status}`);
  return res.json();
}

export async function getClientPlan(clientId: string): Promise<ClientPlan | null> {
  const res = await fetch(`${BACKEND_URL}/plans/client/${clientId}`);
  if (!res.ok) throw new Error(`Failed to fetch client plan: ${res.status}`);
  const data = await res.json();
  return data || null;
}

export async function getUsageAlert(clientId: string): Promise<UsageAlert> {
  const res = await fetch(`${BACKEND_URL}/plans/usage-alert/${clientId}`);
  if (!res.ok) throw new Error(`Failed to fetch usage alert: ${res.status}`);
  return res.json();
}

export async function getAllPlans(): Promise<ClientPlan[]> {
  const res = await fetch(`${BACKEND_URL}/plans/all`);
  if (!res.ok) throw new Error(`Failed to fetch all plans: ${res.status}`);
  return res.json();
}

export async function createCheckoutSession(
  clientId: string,
  tierId: string,
): Promise<CheckoutResponse> {
  const res = await fetch(`${BACKEND_URL}/payments/create-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, tier_id: tierId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Checkout failed: ${res.status}`);
  }
  return res.json();
}

export async function confirmPayment(
  sessionId: string,
  tierId?: string,
  clientId?: string,
): Promise<ClientPlan> {
  const params = new URLSearchParams({ session_id: sessionId });
  if (tierId) params.set('tier_id', tierId);
  if (clientId) params.set('client_id', clientId);
  const res = await fetch(`${BACKEND_URL}/payments/confirm?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Payment confirmation failed: ${res.status}`);
  }
  return res.json();
}
