import { PUBLIC_API_BASE_URL } from '@/lib/public-site-config';

const API_URL = PUBLIC_API_BASE_URL;

export async function exchangeOAuthCode(exchangeCode: string): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/v1/auth/oauth-exchange`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exchangeCode }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { accessToken: string };
  return j.accessToken ?? null;
}

export async function loginWithDemoAccount(): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/v1/auth/demo-login`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { accessToken?: string };
  return j.accessToken ?? null;
}

export async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { accessToken: string };
  return j.accessToken ?? null;
}

export async function logoutSession(accessToken: string | null | undefined): Promise<void> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers,
  });
}
