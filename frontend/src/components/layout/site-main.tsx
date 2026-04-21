'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const centeredMainClass =
  'mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-4 sm:px-6 md:px-8';

/**
 * 월드컵 **플레이**(`/worldcup/templates/{id}`)만 풀 너비.
 * 허브·만들기(`/worldcup/templates`, `/worldcup/templates/new`)는 티어 도메인과 동일하게
 * `max-w-[1600px]` + 좌우 패딩(`px-4 sm:px-6 md:px-8`).
 */
export function SiteMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const worldcupCenteredShell =
    pathname === '/worldcup/templates' || pathname === '/worldcup/templates/new';
  const worldcupFullBleed = pathname.startsWith('/worldcup') && !worldcupCenteredShell;

  if (worldcupFullBleed) {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>
    );
  }

  return <div className={centeredMainClass}>{children}</div>;
}
