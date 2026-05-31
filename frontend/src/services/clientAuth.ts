/**
 * Client Auth Service
 * Manages client sessions stored in localStorage.
 * Clients authenticate via the backend (clients.json) — NOT Supabase.
 */

import { BACKEND_URL } from './elevenLabsApi';

const SESSION_KEY = 'rh_client_session';

export interface ClientSession {
  id: string;
  email: string;
  company_name: string;
  agent_id: string;
  service_area?: string;
  created_at: string;
}

export function getClientSession(): ClientSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as ClientSession) : null;
  } catch {
    return null;
  }
}

export function setClientSession(session: ClientSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearClientSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function clientRegister(data: {
  email: string;
  password: string;
  company_name: string;
  agent_id: string;
  service_area?: string;
}): Promise<ClientSession> {
  const res = await fetch(`${BACKEND_URL}/auth/client/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail ?? 'Registration failed');
  return body as ClientSession;
}

export async function clientLogin(email: string, password: string): Promise<ClientSession> {
  const res = await fetch(`${BACKEND_URL}/auth/client/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail ?? 'Login failed');
  return body as ClientSession;
}
