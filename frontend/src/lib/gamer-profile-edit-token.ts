/**
 * 비회원 프로필 편집 토큰(verify-password 로 발급)을 sessionStorage 에 보관/조회.
 * 키는 슬러그별로 분리하며, 수정/업로드 요청 시 X-Profile-Edit-Token 헤더로 사용한다.
 */
function key(slug: string): string {
  return `gamer-profile-edit-token:${slug}`;
}

export function saveEditToken(slug: string, token: string): void {
  try {
    sessionStorage.setItem(key(slug), token);
  } catch {
    /* ignore */
  }
}

export function loadEditToken(slug: string): string | null {
  try {
    return sessionStorage.getItem(key(slug));
  } catch {
    return null;
  }
}

export function clearEditToken(slug: string): void {
  try {
    sessionStorage.removeItem(key(slug));
  } catch {
    /* ignore */
  }
}
