import { apiFetch } from '@/lib/api-fetch';

export function safeReturnPath(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  /** 로그인 직후 기본 진입: 티어 허브 (내 계정 화면으로 강제하지 않음) */
  return '/templates';
}

/** 소셜 로그인 직후: PENDING 이면 온보딩, 아니면 returnTo 또는 기본 경로 */
export async function resolvePostLoginRoute(token: string, returnTo: string | null): Promise<string> {
  try {
    const res = await apiFetch('/api/v1/user/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return safeReturnPath(returnTo);
    const me = (await res.json()) as { accountStatus: string };
    if (me.accountStatus === 'PENDING') return '/signup/profile';
    return safeReturnPath(returnTo);
  } catch {
    return safeReturnPath(returnTo);
  }
}
