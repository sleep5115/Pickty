/** 빈 문자열 env는 `??`로 걸러지지 않아 상대 경로 fetch → Next 404가 나므로 trim 후 fallback */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:8080';

export function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, options);
}
