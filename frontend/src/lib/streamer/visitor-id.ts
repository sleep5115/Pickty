/**
 * 시청자 1인 1표 식별용 anonymous UUID.
 * - 최초 진입 시 localStorage에 발급·보관 (브라우저 단위 영속)
 * - SSR 안전: window 없으면 빈 문자열 반환 후 클라이언트 mount 시 재호출
 */
const STORAGE_KEY = 'pickty-visitor-id';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 폴백 — RFC 4122 v4 유사 (Math.random 기반, 충돌 가능성은 무시 가능 수준)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ensureVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = generateUuid();
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return generateUuid();
  }
}

export function peekVisitorId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
