/**
 * Admin Auth Service
 * Manages admin sessions stored in localStorage.
 * Admins authenticate via the backend (admins collection/JSON) — NOT Supabase.
 */

import { BACKEND_URL } from './elevenLabsApi';

const SESSION_KEY = 'rh_admin_session';

export interface AdminSession {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export function getAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

export function setAdminSession(session: AdminSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function adminRegister(data: {
  email: string;
  password: string;
  name: string;
}): Promise<AdminSession> {
  const res = await fetch(`${BACKEND_URL}/auth/admin/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail ?? 'Registration failed');
  return body as AdminSession;
}

export async function adminLogin(email: string, password: string): Promise<AdminSession> {
  const res = await fetch(`${BACKEND_URL}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail ?? 'Login failed');
  return body as AdminSession;
}
