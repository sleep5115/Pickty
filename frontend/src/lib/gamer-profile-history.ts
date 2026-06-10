/**
 * 이 브라우저에서 생성/방문한 겜생프로필 주소 ID(슬러그) 최근 기록.
 * localStorage 키 `pickty_profile_history` 에 문자열 배열로 누적한다.
 * ※ DB 프로필을 지우는 게 아니라, 이 브라우저의 바로가기 목록만 관리한다.
 */
const PROFILE_HISTORY_KEY = 'pickty_profile_history';
const MAX_HISTORY = 20;

function read(): string[] {
  try {
    const raw = localStorage.getItem(PROFILE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

function write(slugs: string[]): void {
  try {
    localStorage.setItem(PROFILE_HISTORY_KEY, JSON.stringify(slugs.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore */
  }
}

export function getProfileHistory(): string[] {
  return read();
}

/** 중복 제거 후 맨 앞에 추가(최근 우선). */
export function addProfileHistory(slug: string): void {
  const s = slug.trim().toLowerCase();
  if (s.length === 0) return;
  const next = [s, ...read().filter((x) => x !== s)];
  write(next);
}

export function removeProfileHistory(slug: string): void {
  write(read().filter((x) => x !== slug));
}
