import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="w-full shrink-0 border-t border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-950/50">
      <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500 dark:text-zinc-500">
        <Link
          href="/terms"
          className="hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
        >
          이용약관
        </Link>
        <span className="text-slate-300 dark:text-zinc-700 select-none" aria-hidden>
          ·
        </span>
        <Link
          href="/privacy"
          className="hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
        >
          개인정보처리방침
        </Link>
        <span className="text-slate-300 dark:text-zinc-700 select-none" aria-hidden>
          ·
        </span>
        <a
          href="mailto:picktyofficial@gmail.com"
          className="hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
        >
          문의: picktyofficial@gmail.com
        </a>
      </div>
    </footer>
  );
}
