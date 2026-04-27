/** 비회원 수정 진입: URL `guestPwd` 보조(React Strict Mode 등에서 쿼리 제거 후에도 1회 복구) */
export function communityGuestEditStorageKey(postId: string): string {
  return `pickty_community_guest_edit:${postId}`;
}
