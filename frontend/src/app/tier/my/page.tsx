'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { listMyTierResults, type TierResultSummaryResponse } from '@/lib/tier-api';

function formatSavedAt(isoLocal: string): string {
  try {
    const d = new Date(isoLocal.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return isoLocal;
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return isoLocal;
  }
}

export default function MyTierResultsPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [rows, setRows] = useState<TierResultSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listMyTierResults(accessToken);
      setRows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '불러오기 실패';
      if (msg.includes('401')) {
        clearAuth();
        router.replace('/login?returnTo=/tier/my');
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [accessToken, clearAuth, router]);

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login?returnTo=/tier/my');
      return;
    }
    void load();
  }, [accessToken, load, router]);

  if (!accessToken) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full py-8 px-1 sm:px-2 max-w-3xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">내 티어표</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          저장한 티어표만 이 페이지에 모여 있어요.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link
          href="/templates"
          className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
        >
          템플릿 목록
        </Link>
        <span className="text-slate-300 dark:text-zinc-700">|</span>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
        >
          새로고침
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 px-5 py-8 text-center">
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            아직 저장한 티어표가 없습니다.
          </p>
          <Link
            href="/templates"
            className="mt-4 inline-flex text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
          >
            템플릿 고르고 티어 만들기 →
          </Link>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/tier/result/${encodeURIComponent(r.id)}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 shadow-sm hover:border-violet-400 dark:hover:border-violet-600 transition-colors"
              >
                <div className="min-w-0">
                  <span className="font-medium text-slate-900 dark:text-zinc-100 truncate block">
                    {r.listTitle?.trim() || '제목 없음'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-zinc-500 truncate block">
                    템플릿: {r.templateTitle} · v{r.templateVersion}
                    {r.isPublic ? ' · 공개' : ''}
                  </span>
                </div>
                <span className="text-xs text-slate-400 dark:text-zinc-600 shrink-0 tabular-nums">
                  {formatSavedAt(r.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
