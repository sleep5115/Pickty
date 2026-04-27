'use client';

const MAX_VISIBLE = 5;

function visiblePageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 0) return [];
  if (totalPages <= MAX_VISIBLE) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const half = Math.floor(MAX_VISIBLE / 2);
  let start = currentPage - half;
  let end = currentPage + (MAX_VISIBLE - half - 1);
  if (start < 1) {
    start = 1;
    end = MAX_VISIBLE;
  }
  if (end > totalPages) {
    end = totalPages;
    start = totalPages - MAX_VISIBLE + 1;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export type PaginationProps = {
  /** 1-based */
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

/**
 * 디시·일반 게시판 스타일 번호 페이지네이션 (1-based 페이지).
 */
export function Pagination({ currentPage, totalPages, onPageChange, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const safeCurrent = Math.min(Math.max(1, currentPage), totalPages);
  const nums = visiblePageNumbers(safeCurrent, totalPages);

  const btnBase =
    'inline-flex min-h-9 min-w-9 items-center justify-center rounded border px-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40';
  const navBtn =
    `${btnBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800`;
  const numInactive =
    `${btnBase} border-slate-200 bg-white text-slate-700 hover:border-fuchsia-300 hover:bg-fuchsia-50/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-fuchsia-600 dark:hover:bg-fuchsia-950/30`;
  const numActive =
    `${btnBase} border-fuchsia-500 bg-fuchsia-500 text-white shadow-sm dark:border-fuchsia-600 dark:bg-fuchsia-600`;

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-1 py-4 ${className}`}
      aria-label="페이지 이동"
    >
      <button type="button" className={navBtn} disabled={safeCurrent <= 1} onClick={() => onPageChange(safeCurrent - 1)}>
        이전
      </button>
      {nums.map((n) => (
        <button
          key={n}
          type="button"
          className={n === safeCurrent ? numActive : numInactive}
          aria-current={n === safeCurrent ? 'page' : undefined}
          onClick={() => onPageChange(n)}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className={navBtn}
        disabled={safeCurrent >= totalPages}
        onClick={() => onPageChange(safeCurrent + 1)}
      >
        다음
      </button>
    </nav>
  );
}
