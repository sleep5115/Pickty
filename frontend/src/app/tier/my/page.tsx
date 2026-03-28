'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TierResultCard } from '@/components/tier/tier-result-card';
import { TierResultEditMetaModal } from '@/components/tier/tier-result-edit-meta-modal';
import { TierResultDeleteConfirmDialog } from '@/components/tier/tier-result-delete-confirm-dialog';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { apiFetch } from '@/lib/api-fetch';
import { listMyTierResults, type TierResultSummaryResponse } from '@/lib/tier-api';

export default function MyTierResultsPage() {
  const router = useRouter();
  const hydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [rows, setRows] = useState<TierResultSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: number; role: string } | null>(null);
  const [editTarget, setEditTarget] = useState<TierResultSummaryResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TierResultSummaryResponse | null>(null);

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
      setMe(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok || cancelled) return;
        const u = (await res.json()) as { id?: unknown; role?: unknown };
        const mid = typeof u.id === 'number' ? u.id : Number(u.id);
        const role = typeof u.role === 'string' ? u.role : '';
        if (Number.isFinite(mid)) {
          setMe({ id: mid, role });
        }
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) {
      setLoading(false);
      router.replace('/login?returnTo=/tier/my');
      return;
    }
    void load();
  }, [hydrated, accessToken, load, router]);

  if (!hydrated || !accessToken) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full py-8 px-1 sm:px-2 max-w-5xl mx-auto flex flex-col gap-6">
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
        <Link
          href="/tier/feed"
          className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
        >
          티어표
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
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <TierResultCard
              key={r.id}
              result={r}
              currentUserId={me?.id ?? null}
              isAdmin={me?.role === 'ADMIN'}
              accessToken={accessToken}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />
          ))}
        </ul>
      )}

      {accessToken && editTarget && (
        <TierResultEditMetaModal
          open
          onClose={() => setEditTarget(null)}
          resultId={editTarget.id}
          accessToken={accessToken}
          initialTitle={editTarget.listTitle ?? ''}
          initialDescription={editTarget.listDescription ?? ''}
          onSaved={() => {
            void load();
            toast.success('저장했어요.');
          }}
        />
      )}
      {accessToken && deleteTarget && (
        <TierResultDeleteConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          resultId={deleteTarget.id}
          accessToken={accessToken}
          onDeleted={() => {
            void load();
            toast.success('삭제했어요.');
          }}
        />
      )}
    </div>
  );
}
