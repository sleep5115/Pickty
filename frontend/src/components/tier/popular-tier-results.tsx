'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TierResultCard } from '@/components/tier/tier-result-card';
import { TierResultDeleteConfirmDialog } from '@/components/tier/tier-result-delete-confirm-dialog';
import { TierResultEditMetaModal } from '@/components/tier/tier-result-edit-meta-modal';
import {
  listPopularTierResultsByTemplate,
  type TierResultSummaryResponse,
} from '@/lib/tier-api';

export type PopularTierResultsProps = {
  templateId: string;
  currentUserId: number | null;
  isAdmin: boolean;
  accessToken: string | null;
};

export function PopularTierResults({
  templateId,
  currentUserId,
  isAdmin,
  accessToken,
}: PopularTierResultsProps) {
  const [data, setData] = useState<'loading' | TierResultSummaryResponse[]>('loading');
  const [editTarget, setEditTarget] = useState<TierResultSummaryResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TierResultSummaryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listPopularTierResultsByTemplate(templateId, accessToken ?? null, 3);
        if (!cancelled) setData(rows);
      } catch {
        if (!cancelled) setData([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, accessToken]);

  if (data === 'loading' || data.length === 0) {
    return null;
  }

  const items = data;

  return (
    <section
      className="shrink-0 border-t border-slate-200 bg-gradient-to-b from-amber-50/80 to-slate-50/90 px-3 py-5 dark:border-zinc-800 dark:from-amber-950/25 dark:to-zinc-950/80 sm:px-4"
      aria-label="인기 티어표"
    >
      <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-lg">
        <span aria-hidden>🔥</span> 인기 티어표
      </h3>
      <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400 sm:text-sm">
        이 템플릿으로 만든 티어표 중 추천을 많이 받은 티어표예요.
      </p>
      <ul className="mt-4 m-0 flex list-none flex-row gap-4 overflow-x-auto overflow-y-visible pb-2 [-webkit-overflow-scrolling:touch] md:grid md:grid-cols-3 md:gap-4 md:overflow-x-visible md:pb-0 [&>li]:w-[min(20rem,calc(100vw-2rem))] [&>li]:max-w-full [&>li]:shrink-0 md:[&>li]:w-auto md:[&>li]:shrink">
        {items.map((r) => (
          <TierResultCard
            key={r.id}
            result={r}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            accessToken={accessToken}
            onEdit={setEditTarget}
            onDelete={setDeleteTarget}
            onVoteCountsChange={(resultId, upCount, downCount) => {
              setData((prev) => {
                if (prev === 'loading') return prev;
                return prev.map((row) =>
                  row.id === resultId ? { ...row, upCount, downCount } : row,
                );
              });
            }}
            onResultMyReactionResolved={(resultId, reaction) => {
              setData((prev) => {
                if (prev === 'loading') return prev;
                return prev.map((row) =>
                  row.id === resultId ? { ...row, myReaction: reaction } : row,
                );
              });
            }}
          />
        ))}
      </ul>

      {accessToken && editTarget && (
        <TierResultEditMetaModal
          open
          onClose={() => setEditTarget(null)}
          resultId={editTarget.id}
          accessToken={accessToken}
          initialTitle={editTarget.listTitle ?? ''}
          initialDescription={editTarget.listDescription ?? ''}
          onSaved={(updated) => {
            setData((prev) => {
              if (prev === 'loading') return prev;
              return prev.map((row) =>
                row.id === updated.id
                  ? {
                      ...row,
                      listTitle: updated.listTitle,
                      listDescription: updated.listDescription,
                      thumbnailUrl: updated.thumbnailUrl ?? row.thumbnailUrl,
                    }
                  : row,
              );
            });
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
            setData((prev) => {
              if (prev === 'loading') return prev;
              return prev.filter((row) => row.id !== deleteTarget.id);
            });
            toast.success('삭제했어요.');
          }}
        />
      )}
    </section>
  );
}
