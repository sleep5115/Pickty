'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { TierResultCard } from '@/components/tier/tier-result-card';
import { TierResultEditMetaModal } from '@/components/tier/tier-result-edit-meta-modal';
import { TierResultDeleteConfirmDialog } from '@/components/tier/tier-result-delete-confirm-dialog';
import { apiFetch } from '@/lib/api-fetch';
import {
  listTierResultsFeedPage,
  type TierResultSummaryResponse,
} from '@/lib/tier-api';
import { useAuthStore } from '@/lib/store/auth-store';

export default function TierFeedPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [me, setMe] = useState<{ id: number; role: string } | null>(null);
  const [items, setItems] = useState<TierResultSummaryResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const nextPageRef = useRef(0);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [editTarget, setEditTarget] = useState<TierResultSummaryResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TierResultSummaryResponse | null>(null);

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

  const fetchPage = useCallback(async (pageIndex: number, append: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (pageIndex === 0) setInitialLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const data = await listTierResultsFeedPage(pageIndex, 12, accessToken ?? null);
      setItems((prev) => (append ? [...prev, ...data.content] : data.content));
      setHasMore(!data.last);
      nextPageRef.current = pageIndex + 1;
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      loadingRef.current = false;
      setInitialLoading(false);
      setLoadingMore(false);
    }
  }, [accessToken]);

  useEffect(() => {
    nextPageRef.current = 0;
    setHasMore(true);
    void fetchPage(0, false);
  }, [fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit || !hasMore || loadingRef.current || initialLoading) return;
        void fetchPage(nextPageRef.current, true);
      },
      { root: null, rootMargin: '240px', threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchPage, hasMore, initialLoading, items.length]);

  return (
    <div className="w-full py-8 px-1 sm:px-2 flex flex-col gap-6">
      <div className="w-full">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">티어표</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          모두가 만든 티어표를 최신순으로 모아 보여요.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link
          href="/templates"
          className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
        >
          템플릿 목록
        </Link>
        {accessToken && (
          <>
            <span className="text-slate-300 dark:text-zinc-700">|</span>
            <Link
              href="/tier/my"
              className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              내 티어표
            </Link>
          </>
        )}
      </div>

      <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">

      {initialLoading && (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      )}

      {!initialLoading && error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {!initialLoading && !error && items.length === 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 px-5 py-8 text-center">
          <p className="text-sm text-slate-600 dark:text-zinc-400">아직 공개된 티어표가 없습니다.</p>
          <Link
            href="/templates"
            className="mt-4 inline-flex text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
          >
            템플릿 고르고 티어 만들기 →
          </Link>
        </div>
      )}

      {!initialLoading && !error && items.length > 0 && (
        <>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((r) => (
              <TierResultCard
                key={r.id}
                result={r}
                currentUserId={me?.id ?? null}
                isAdmin={me?.role === 'ADMIN'}
                accessToken={accessToken}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
                onVoteCountsChange={(resultId, upCount, downCount) => {
                  setItems((prev) =>
                    prev.map((row) =>
                      row.id === resultId ? { ...row, upCount, downCount } : row,
                    ),
                  );
                }}
                onResultMyReactionResolved={(resultId, reaction) => {
                  setItems((prev) =>
                    prev.map((row) =>
                      row.id === resultId ? { ...row, myReaction: reaction } : row,
                    ),
                  );
                }}
              />
            ))}
          </ul>
          <div ref={sentinelRef} className="h-4 w-full shrink-0" aria-hidden />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          )}
        </>
      )}

      {accessToken && editTarget && (
        <TierResultEditMetaModal
          open
          onClose={() => setEditTarget(null)}
          resultId={editTarget.id}
          accessToken={accessToken}
          initialTitle={editTarget.listTitle ?? ''}
          initialDescription={editTarget.listDescription ?? ''}
          onSaved={(updated) => {
            setItems((prev) =>
              prev.map((row) =>
                row.id === updated.id
                  ? {
                      ...row,
                      listTitle: updated.listTitle,
                      listDescription: updated.listDescription,
                      thumbnailUrl: updated.thumbnailUrl ?? row.thumbnailUrl,
                    }
                  : row,
              ),
            );
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
            setItems((prev) => prev.filter((row) => row.id !== deleteTarget.id));
            toast.success('삭제했어요.');
          }}
        />
      )}
      </div>
    </div>
  );
}
