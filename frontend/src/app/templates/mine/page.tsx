'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TemplateCard } from '@/components/template/template-card';
import { TemplateEditMetaModal } from '@/components/template/template-edit-meta-modal';
import { TemplateDeleteConfirmDialog } from '@/components/template/template-delete-confirm-dialog';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { listMyTemplates, type TemplateSummaryResponse } from '@/lib/tier-api';

export default function MyTemplatesPage() {
  const router = useRouter();
  const hydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [rows, setRows] = useState<TemplateSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: number; role: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateSummaryResponse | null>(null);
  const [editMetaTarget, setEditMetaTarget] = useState<TemplateSummaryResponse | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listMyTemplates(accessToken);
      setRows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '목록을 불러오지 못했습니다.';
      if (msg.includes('401')) {
        clearAuth();
        router.replace('/login?returnTo=/templates/mine');
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [accessToken, clearAuth, router]);

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) {
      setLoading(false);
      router.replace('/login?returnTo=/templates/mine');
      return;
    }
    void load();
  }, [hydrated, accessToken, load, router]);

  useEffect(() => {
    if (!hydrated || !accessToken) {
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
  }, [hydrated, accessToken]);

  if (!hydrated || !accessToken) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-8 px-1 py-8 sm:px-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">내 템플릿</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            내가 만든 템플릿만 모아 보여요. 티어표를 만들거나 제목·설명을 수정할 수 있어요.
          </p>
        </div>
        <Link
          href="/template/new"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-violet-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/25 transition-colors hover:bg-violet-500 dark:bg-violet-600 dark:shadow-violet-900/30 dark:hover:bg-violet-500"
        >
          새 템플릿 만들기
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/templates"
          className="font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          전체 템플릿
        </Link>
        <span className="text-slate-300 dark:text-zinc-700">|</span>
        <Link
          href="/tier/my"
          className="font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          내 티어표
        </Link>
        <span className="text-slate-300 dark:text-zinc-700">|</span>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="font-medium text-violet-600 hover:underline disabled:opacity-50 dark:text-violet-400"
        >
          새로고침
        </button>
      </div>

      <section aria-labelledby="my-templates-heading">
        <h2 id="my-templates-heading" className="sr-only">
          내가 만든 템플릿 목록
        </h2>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-5 py-8 text-center dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              아직 만든 템플릿이 없어요. <strong>새 템플릿 만들기</strong>로 첫 템플릿을 만들어 보세요.
            </p>
            <Link
              href="/template/new"
              className="mt-4 inline-flex text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400"
            >
              새 템플릿 만들기 →
            </Link>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((t) => (
              <TemplateCard
                key={t.id}
                row={t}
                currentUserId={me?.id ?? null}
                isAdmin={me?.role === 'ADMIN'}
                accessToken={accessToken}
                onMyReactionResolved={(templateId, reaction) => {
                  setRows((prev) =>
                    prev.map((r) => (r.id === templateId ? { ...r, myReaction: reaction } : r)),
                  );
                }}
                onLikeCountChange={(templateId, likeCount) => {
                  setRows((prev) =>
                    prev.map((r) => (r.id === templateId ? { ...r, likeCount } : r)),
                  );
                }}
                onEdit={(target) => setEditMetaTarget(target)}
                onDelete={(target) => setDeleteTarget(target)}
              />
            ))}
          </ul>
        )}
      </section>

      {editMetaTarget && (
        <TemplateEditMetaModal
          open
          onClose={() => setEditMetaTarget(null)}
          templateId={editMetaTarget.id}
          accessToken={accessToken}
          initialTitle={editMetaTarget.title}
          initialDescription={editMetaTarget.description ?? ''}
          onSaved={(u) => {
            setRows((prev) =>
              prev.map((r) =>
                r.id === u.id
                  ? { ...r, title: u.title, description: u.description, version: u.version }
                  : r,
              ),
            );
            toast.success('저장했어요.');
          }}
        />
      )}

      {deleteTarget && (
        <TemplateDeleteConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          templateId={deleteTarget.id}
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
