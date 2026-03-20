import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function TierDashboard() {
  return (
    <main className="relative min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center transition-colors duration-300">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Link
          href="/login"
          className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700 hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 bg-white dark:bg-zinc-900 transition-all duration-200"
        >
          로그인
        </Link>
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <span className="text-5xl">🏆</span>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-zinc-100">
          여기는 티어 대시보드입니다
        </h1>
        <p className="text-slate-500 dark:text-zinc-400">
          티어표 만들기 기능이 곧 완성됩니다
        </p>
        <Link
          href="/"
          className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700 hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 bg-white dark:bg-zinc-900 transition-all duration-200"
        >
          ← 홈으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
