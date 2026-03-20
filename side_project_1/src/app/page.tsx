import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Home() {
  return (
    <main className="relative min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-10 px-4 transition-colors duration-300">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Link
          href="/login"
          className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700 hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 bg-white dark:bg-zinc-900 transition-all duration-200"
        >
          로그인
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center gap-4">
        <h1 className="text-8xl font-black tracking-tight bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 dark:from-violet-400 dark:via-fuchsia-400 dark:to-pink-400 bg-clip-text text-transparent drop-shadow-lg">
          Pickty
        </h1>
        <p className="text-slate-500 dark:text-zinc-400 text-xl font-medium tracking-wide">
          티어표 만들기 & 이상형 월드컵
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/tier"
          className="px-8 py-3.5 rounded-2xl font-semibold text-white bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-500/20 dark:shadow-violet-900/40 transition-all duration-200 hover:scale-105"
        >
          티어표 만들기
        </Link>
        <Link
          href="/worldcup"
          className="px-8 py-3.5 rounded-2xl font-semibold text-slate-700 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 hover:border-fuchsia-400 dark:hover:border-fuchsia-500 hover:text-fuchsia-600 dark:hover:text-fuchsia-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all duration-200 hover:scale-105"
        >
          월드컵 시작하기
        </Link>
      </div>
    </main>
  );
}
