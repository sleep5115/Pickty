import Link from 'next/link';

/**
 * 이상형 월드컵 — 후순위 미구현.
 * GNB·메인 등에서는 링크/문구 숨김. URL 직접 접근 시에만 이 화면.
 */
export default function WorldcupDashboard() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-zinc-100">준비 중입니다</h1>
      <p className="text-sm text-slate-500 dark:text-zinc-400">곧 이용할 수 있도록 준비하고 있어요.</p>
      <Link
        href="/"
        className="mt-2 px-6 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700 hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 bg-white dark:bg-zinc-900 transition-all duration-200"
      >
        홈으로
      </Link>
      {/*
      후순위 미구현 (원문)
      <span className="text-5xl">⚔️</span>
      <h1>여기는 월드컵 대시보드입니다</h1>
      <p>이상형 월드컵 기능이 곧 완성됩니다</p>
      */}
    </div>
  );
}
