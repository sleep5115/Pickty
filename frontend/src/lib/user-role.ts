/**
 * 백엔드 `Role.ADMIN` — `GET /api/v1/user/me` 의 `role` 필드에 enum 이름으로 직렬화됩니다.
 * (Spring `Role.name` → `"ADMIN"`, Spring Security 표기 `ROLE_ADMIN` 과는 별개)
 */
export const PICKTY_USER_ROLE_ADMIN = 'ADMIN' as const;

export function isPicktyAdminRole(role: string | null | undefined): boolean {
  return role === PICKTY_USER_ROLE_ADMIN;
}
