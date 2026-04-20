'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
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
  const hydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorldCupTemplateSummaryDto[]>([]);
  const [me, setMe] = useState<{ id: number } | null>(null);

  const [editTarget, setEditTarget] = useState<WorldCupTemplateSummaryDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorldCupTemplateSummaryDto | null>(null);

  const load = useCallback(async () => {
    setPhase('loading');
    setErrorMessage(null);
    try {
      const res = await fetchWorldCupTemplateList();
      if (!res.ok) {
        setErrorMessage(`목록을 불러오지 못했습니다. (${res.status})`);
        setPhase('error');
        return;
      }
      const data = (await res.json()) as WorldCupTemplateSummaryDto[];
      setTemplates(Array.isArray(data) ? data : []);
      setPhase('ready');
    } catch {
      setErrorMessage('네트워크 오류가 발생했습니다.');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!hydrated || !accessToken) {
        setMe(null);
        return;
      }
      void (async () => {
        try {
          const res = await apiFetch('/api/v1/user/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!res.ok || cancelled) return;
          const u = (await res.json()) as { id?: unknown };
          const mid = typeof u.id === 'number' ? u.id : Number(u.id);
          if (Number.isFinite(mid)) {
            setMe({ id: mid });
          }
        } catch {
          if (!cancelled) setMe(null);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken]);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-8 sm:px-6 md:px-8">
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-amber-300/70 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/25">
              <Trophy className="size-6" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">이상형 월드컵</h1>
              <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
                템플릿을 고르면 바로 대진이 시작됩니다. 링크로 공유해 친구와 같이 즐길 수 있어요.
              </p>
            </div>
          </div>
          <Link
            href={accessToken ? '/worldcup/new' : '/login?returnTo=/worldcup/new'}
            className="mt-4 shrink-0 self-start rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-400 hover:text-violet-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-violet-500 sm:mt-0"
          >
            월드컵 템플릿 만들기
          </Link>
        </div>

        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500 dark:text-zinc-500">
            <Loader2 className="size-9 animate-spin text-violet-600 dark:text-violet-400" aria-hidden />
            <p className="text-sm font-medium">목록을 불러오는 중…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-center text-sm text-rose-600 dark:text-rose-400">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-500"
            >
              다시 시도
            </button>
          </div>
        )}

        {phase === 'ready' && templates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              아직 등록된 월드컵 템플릿이 없습니다.
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
              위에서 월드컵 템플릿을 만들거나 등록하면 여기에 표시됩니다.
            </p>
          </div>
        )}

        {phase === 'ready' && templates.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <WorldCupTemplateHubCard
                key={t.id}
                row={t}
                currentUserId={me?.id ?? null}
                accessToken={accessToken}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}
      </div>

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
          }}
        />
      ) : null}
    </div>
  );
}
