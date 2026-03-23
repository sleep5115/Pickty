/** 빈 문자열 env는 `??`로 걸러지지 않아 상대 경로 fetch → Next 404가 나므로 trim 후 fallback */
import { PUBLIC_API_BASE_URL } from '@/lib/public-site-config';

const API_URL = PUBLIC_API_BASE_URL;

export function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, options);
}
