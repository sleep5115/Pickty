'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import {
  fetchWorldCupTemplateList,
  type WorldCupTemplateSummaryDto,
} from '@/lib/worldcup/worldcup-template-api';
import { WorldCupDeleteConfirmDialog } from '@/components/worldcup/worldcup-delete-confirm-dialog';
import { WorldCupEditMetaModal } from '@/components/worldcup/worldcup-edit-meta-modal';
import { WorldCupTemplateHubCard } from '@/components/worldcup/worldcup-template-hub-card';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';

export default function WorldcupDashboard() {
  const router = useRouter();
  const hydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorldCupTemplateSummaryDto[]>([]);
  const [me, setMe] = useState<{ id: number; role: string } | null>(null);

  const [editTarget, setEditTarget] = useState<WorldCupTemplateSummaryDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorldCupTemplateSummaryDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchWorldCupTemplateList(accessToken ?? null);
      if (!res.ok) {
        setErrorMessage(`목록을 불러오지 못했습니다. (${res.status})`);
        return;
      }
      const data = (await res.json()) as WorldCupTemplateSummaryDto[];
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      setErrorMessage('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <div className="flex w-full flex-col gap-8 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            이상형 월드컵 템플릿
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            템플릿을 고르면 바로 대진이 시작됩니다. 링크로 공유해 친구와 같이 즐길 수 있어요.
          </p>
        </div>
        <Link
          href={accessToken ? '/worldcup/templates/new' : '/login?returnTo=/worldcup/templates/new'}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-violet-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/25 transition-colors hover:bg-violet-500 dark:bg-violet-600 dark:shadow-violet-900/30 dark:hover:bg-violet-500"
        >
          새 템플릿 만들기
        </Link>
      </div>

      <section aria-labelledby="worldcup-templates-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2
            id="worldcup-templates-heading"
            className="text-sm font-semibold text-slate-800 dark:text-zinc-200"
          >
            등록된 템플릿
          </h2>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="text-xs font-medium text-violet-600 hover:underline disabled:opacity-50 dark:text-violet-400"
          >
            새로고침
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        )}

        {!loading && errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          >
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && templates.length === 0 && (
          <p className="py-6 text-sm text-slate-600 dark:text-zinc-400">
            아직 등록된 템플릿이 없습니다. 상단의 <strong>새 템플릿 만들기</strong>로 첫 월드컵을 만들어 보세요.
          </p>
        )}

        {!loading && !errorMessage && templates.length > 0 && (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {templates.map((t) => (
              <WorldCupTemplateHubCard
                key={t.id}
                row={t}
                currentUserId={me?.id ?? null}
                isAdmin={me?.role === 'ADMIN'}
                accessToken={accessToken}
                onMyReactionResolved={(templateId, reaction) => {
                  setTemplates((prev) =>
                    prev.map((r) => (r.id === templateId ? { ...r, myReaction: reaction } : r)),
                  );
                }}
                onLikeCountChange={(templateId, likeCount) => {
                  setTemplates((prev) =>
                    prev.map((r) => (r.id === templateId ? { ...r, likeCount } : r)),
                  );
                }}
                onEdit={(target) => {
                  if (!accessToken) {
                    router.push('/login?returnTo=/worldcup/templates');
                    return;
                  }
                  setEditTarget(target);
                }}
                onDelete={(target) => {
                  if (!accessToken) {
                    router.push('/login?returnTo=/worldcup/templates');
                    return;
                  }
                  setDeleteTarget(target);
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {accessToken && editTarget ? (
        <WorldCupEditMetaModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          templateId={editTarget.id}
          accessToken={accessToken}
          initialTitle={editTarget.title}
          initialDescription={editTarget.description ?? ''}
          onSaved={(u) => {
            setTemplates((prev) =>
              prev.map((r) =>
                r.id === u.id
                  ? {
                      ...r,
                      title: u.title,
                      description: u.description,
                      version: u.version,
                    }
                  : r,
              ),
            );
            toast.success('저장했어요.');
          }}
        />
      ) : null}

      {accessToken && deleteTarget ? (
        <WorldCupDeleteConfirmDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          templateId={deleteTarget.id}
          accessToken={accessToken}
          onDeleted={() => {
            setTemplates((prev) => prev.filter((r) => r.id !== deleteTarget.id));
            setDeleteTarget(null);
            toast.success('삭제했어요.');
          }}
        />
      ) : null}
    </div>
  );
}
