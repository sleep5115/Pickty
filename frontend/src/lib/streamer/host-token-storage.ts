/**
 * 방장 hostToken을 sessionId별로 localStorage 에 보관.
 * - localStorage 채택 이유: 새 탭/새로고침에서도 잃지 않게(sessionStorage는 탭별 격리)
 * - 형식: `pickty-streamer-host-token:{sessionId}` → hostToken 문자열
 * - 유실 시 fallback-token API로 복구 가능
 */
const PREFIX = 'pickty-streamer-host-token:';

export function saveHostToken(sessionId: string, token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${PREFIX}${sessionId}`, token);
  } catch {
    /* swallow quota errors — UX는 fallback-token으로 복구 */
  }
}

export function loadHostToken(sessionId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(`${PREFIX}${sessionId}`);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearHostToken(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${PREFIX}${sessionId}`);
  } catch {
    /* noop */
  }
}
