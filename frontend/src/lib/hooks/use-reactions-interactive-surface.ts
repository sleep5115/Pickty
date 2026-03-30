'use client';

import { usePathname } from 'next/navigation';

/**
 * 템플릿 좋아요·결과 추천/비추천 API 토글은 티어 메이커(`/tier`) 또는 결과 상세(`/tier/result/…`)에서만 허용.
 * 목록·피드·내 티어표 등에서는 수치만 표시.
 */
export function useReactionsInteractiveSurface(): boolean {
  const pathname = usePathname() ?? '';
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/tier') return true;
  if (pathname.startsWith('/tier/result')) return true;
  return false;
}
