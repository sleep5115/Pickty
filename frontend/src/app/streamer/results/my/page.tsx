'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useAuthStore } from '@/lib/store/auth-store';
import { fetchMyStreamingResults, type StreamerResultListItem } from '@/lib/streamer/streamer-api';

export default function MyStreamingResultsPage() {
  const router = useRouter();
  const authHydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [items, setItems] = useState<StreamerResultListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authHydrated) return;
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    fetchMyStreamingResults()
      .then((r) => {
        if (!cancelled) setItems(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기에 실패했어요.');
      });
    return () => {
      cancelled = true;
    };
  }, [authHydrated, accessToken, router]);

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <h1 className="mb-1 text-xl font-bold">내 스트리밍</h1>
      <p className="mb-4 text-xs text-zinc-500">종료된 스트리머 세션의 시청자 집계 결과를 다시 볼 수 있어요.</p>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {items === null && !error ? (
        <p className="text-sm text-zinc-500">불러오는 중…</p>
      ) : items && items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          아직 종료된 스트리밍이 없어요. 티어표 스트리머 모드에서 &lsquo;세션 종료&rsquo;를 누르면 결과가 여기에 남아요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items?.map((it) => (
            <li key={it.id}>
              <Link
                href={`/streamer/results/${it.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {it.templateType === 'TIER' ? '티어표' : '월드컵'} · 시청자 {it.tierSubmissions}명 참여
                  </div>
                  <div className="text-xs text-zinc-500">{formatDate(it.finishedAt)} 종료</div>
                </div>
                <span className="shrink-0 text-xs text-zinc-400">결과 보기 →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
