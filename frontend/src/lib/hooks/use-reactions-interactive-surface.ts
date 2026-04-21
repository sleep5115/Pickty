'use client';

import { usePathname } from 'next/navigation';

/**
 * 템플릿 좋아요·결과 추천/비추천 API 토글은 플레이·메이커 화면에서만 허용.
 * 목록·허브 등에서는 수치만 표시.
 */
export function useReactionsInteractiveSurface(): boolean {
  const pathname = usePathname() ?? '';
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/tier') return true;
  if (pathname.startsWith('/tier/results/')) return true;
  if (pathname.startsWith('/tier/templates/')) {
    const rest = pathname.slice('/tier/templates/'.length).split('/')[0] ?? '';
    if (rest !== '' && rest !== 'new' && rest !== 'my') return true;
  }
  if (pathname.startsWith('/worldcup/templates/')) {
    const rest = pathname.slice('/worldcup/templates/'.length).split('/')[0] ?? '';
    if (rest !== '' && rest !== 'new' && rest !== 'my') return true;
  }
  return false;
}
