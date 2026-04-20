'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const centeredMainClass =
  'mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-4 sm:px-6 md:px-8';

/**
 * `/worldcup/*` 만 풀 너비 — 그 외 페이지는 울트라와이드에서 `max-w-[1600px]` 로 읽기 폭 제한.
 */
export function SiteMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const worldcupFullBleed =
    pathname === '/worldcup' || pathname.startsWith('/worldcup/');

  if (worldcupFullBleed) {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>
    );
  }

  return <div className={centeredMainClass}>{children}</div>;
}
