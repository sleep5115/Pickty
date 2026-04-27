import { Suspense } from 'react';
import CommunityBoardClient from './community-board-client';

function CommunityBoardFallback() {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] w-full bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="flex w-full flex-col gap-6 py-8">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-800" aria-hidden />
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-3 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">불러오는 중…</div>
        </div>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<CommunityBoardFallback />}>
      <CommunityBoardClient />
    </Suspense>
  );
}
