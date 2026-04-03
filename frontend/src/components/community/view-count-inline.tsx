'use client';

import { useMemo } from 'react';
import { Eye } from 'lucide-react';

function formatViewCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  return new Intl.NumberFormat('ko-KR').format(Math.floor(n));
}

type ViewCountInlineProps = {
  count: number;
  className?: string;
  iconClassName?: string;
};

/** 조회수 — 커뮤니티 카드·헤더에서 Eye + 숫자 */
export function ViewCountInline({ count, className, iconClassName }: ViewCountInlineProps) {
  const label = useMemo(() => formatViewCount(count), [count]);
  return (
    <span
      className={[
        'inline-flex items-center gap-1 text-slate-500 dark:text-zinc-500 tabular-nums',
        className ?? '',
      ].join(' ')}
      title={`조회 ${label}`}
    >
      <Eye
        className={['h-3.5 w-3.5 shrink-0 opacity-75', iconClassName ?? ''].join(' ')}
        strokeWidth={2}
        aria-hidden
      />
      <span className="text-xs font-medium leading-none">{label}</span>
    </span>
  );
}
