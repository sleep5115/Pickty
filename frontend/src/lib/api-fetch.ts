/** 빈 문자열 env는 `??`로 걸러지지 않아 상대 경로 fetch → Next 404가 나므로 trim 후 fallback */
import { PUBLIC_API_BASE_URL } from '@/lib/public-site-config';
import { refreshAccessToken } from '@/lib/auth-session';
import { useAuthStore } from '@/lib/store/auth-store';

const API_URL = PUBLIC_API_BASE_URL;

export function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (typeof window === 'undefined') {
    return fetch(`${API_URL}${path}`, options);
  }

  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(options.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return (async () => {
    let res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const hadBearer = !!token || headers.has('Authorization');
    if (res.status === 401 && hadBearer) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        useAuthStore.getState().setAccessToken(newToken);
        const h2 = new Headers(options.headers);
        h2.set('Authorization', `Bearer ${newToken}`);
        res = await fetch(`${API_URL}${path}`, {
          ...options,
          headers: h2,
          credentials: 'include',
        });
        if (res.status === 401) {
          useAuthStore.getState().clearAuth();
        }
      } else {
        useAuthStore.getState().clearAuth();
      }
    }

    return res;
  })();
}
