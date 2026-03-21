import Link from 'next/link';

export default function WorldcupDashboard() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
      <span className="text-5xl">⚔️</span>
      <h1 className="text-3xl font-bold text-slate-800 dark:text-zinc-100">
        여기는 월드컵 대시보드입니다
      </h1>
      <p className="text-slate-500 dark:text-zinc-400">
        이상형 월드컵 기능이 곧 완성됩니다
      </p>
      <Link
        href="/"
        className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700 hover:border-fuchsia-400 dark:hover:border-fuchsia-500 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 bg-white dark:bg-zinc-900 transition-all duration-200"
      >
        ← 홈으로 돌아가기
      </Link>
    </div>
  );
}
