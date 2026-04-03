'use client';

import { Suspense, startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { TierBoard } from '@/components/tier/tier-board';
import { ImagePreviewModal } from '@/components/tier/image-preview-modal';
import { CommentSection } from '@/components/community/comment-section';
import { PopularTierResults } from '@/components/tier/popular-tier-results';
import { TemplateLikeButton } from '@/components/community/template-like-button';
import { ViewCountInline } from '@/components/community/view-count-inline';
import { TemplateDeleteConfirmDialog } from '@/components/template/template-delete-confirm-dialog';
import { TemplateEditMetaModal } from '@/components/template/template-edit-meta-modal';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useAuthStore } from '@/lib/store/auth-store';
import { useTierStore } from '@/lib/store/tier-store';
import { useTierPersistHydrated } from '@/lib/hooks/use-tier-persist-hydrated';
import { usePointerDevice } from '@/hooks/use-pointer-device';
import type { CommunityReactionType } from '@/lib/api/community-api';
import {
  getTemplate,
  getTierResult,
  templateItemsDescription,
  templatePayloadToTierItems,
} from '@/lib/tier-api';
import { parseSnapshotDataToBoard } from '@/lib/tier-snapshot';

function TierPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get('templateId');
  const sourceResultIdParam = searchParams.get('sourceResultId');
  const loadTemplateWorkspace = useTierStore((s) => s.loadTemplateWorkspace);
  const hydrateFromResultSnapshot = useTierStore((s) => s.hydrateFromResultSnapshot);
  const tierHydrated = useTierPersistHydrated();
  const authHydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);

  const { clearTarget, resetBoard, setPreviewItem } = useTierStore();
  const templateId = useTierStore((s) => s.templateId);
  const workspaceTemplateTitle = useTierStore((s) => s.workspaceTemplateTitle);
  const workspaceTemplateDescription = useTierStore((s) => s.workspaceTemplateDescription);
  const { isPointerFine } = usePointerDevice();
  const [deviceReady, setDeviceReady] = useState(false);
  const isFine = deviceReady ? (isPointerFine ?? true) : true;

  const [templateBanner, setTemplateBanner] = useState<string | null>(null);
  const [templateCreatorId, setTemplateCreatorId] = useState<number | null>(null);
  const [templateLikeCount, setTemplateLikeCount] = useState(0);
  const [templateViewCount, setTemplateViewCount] = useState(0);
  const [templateMyReaction, setTemplateMyReaction] = useState<CommunityReactionType | null>(null);
  const [me, setMe] = useState<{ id: number; role: string } | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  /** intent로 워크스페이스 effect가 getTemplate을 안 할 때만 조회수 집계(같은 tid 재요청은 제외) */
  const templateAuthSyncCountRef = useRef<string | null>(null);

  const dragSelectRef = useRef<HTMLDivElement>(null);

  const copyTemplateShareLink = useCallback(async () => {
    if (!templateId || typeof window === 'undefined') return;
    const url = `${window.location.origin}/tier?templateId=${encodeURIComponent(templateId)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('클립보드에 복사했어요.');
    } catch {
      toast.error('복사에 실패했어요. 주소 표시줄의 URL을 직접 복사해 주세요.');
    }
  }, [templateId]);

  const slimOutlineBtn =
    'text-xs px-2 py-1 rounded border font-medium transition-colors border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/80';

  useEffect(() => {
    startTransition(() => setDeviceReady(true));
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPreviewItem(null);
      clearTarget();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearTarget, setPreviewItem]);

  useEffect(() => {
    if (!authHydrated || !accessToken) {
      queueMicrotask(() => setMe(null));
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
  }, [authHydrated, accessToken]);

  useEffect(() => {
    if (!headerMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeaderMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [headerMenuOpen]);

  useEffect(() => {
    templateAuthSyncCountRef.current = null;
  }, [templateIdParam]);

  /**
   * 로그인/토큰 변경 시 `myReaction`·좋아요·표시용 조회수 동기화.
   * 워크스페이스 effect가 같은 URL로 getTemplate을 호출할 때는 countView=false로 이중 집계 방지.
   * intent 이어쓰기로 워크스페이스 effect가 GET을 생략하면 여기서만 집계(같은 tid 재요청은 false).
   */
  useEffect(() => {
    if (!tierHydrated) return;
    const tid = templateIdParam ?? templateId;
    if (!tid) return;

    const snap = useTierStore.getState();
    const workspaceGetSkipped =
      Boolean(templateIdParam) &&
      snap.tierAutoSaveIntent &&
      snap.templateId != null &&
      snap.templateId === templateIdParam;

    const countView =
      workspaceGetSkipped && templateAuthSyncCountRef.current !== tid;
    if (countView) templateAuthSyncCountRef.current = tid;

    let cancelled = false;
    void getTemplate(tid, accessToken ?? null, { countView }).then((d) => {
      if (cancelled) return;
      setTemplateMyReaction(d.myReaction ?? null);
      setTemplateLikeCount(d.likeCount ?? 0);
      setTemplateViewCount(d.viewCount ?? 0);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tierHydrated, accessToken, templateIdParam, templateId]);

  useEffect(() => {
    if (!tierHydrated) return;

    if (sourceResultIdParam) {
      let cancelled = false;
      startTransition(() => {
        setTemplateBanner('티어표 불러오는 중…');
        setTemplateCreatorId(null);
      });
      void (async () => {
        try {
          const res = await getTierResult(sourceResultIdParam, useAuthStore.getState().accessToken ?? null);
          if (cancelled) return;
          if (templateIdParam && res.templateId !== templateIdParam) {
            setTemplateBanner('URL의 템플릿과 결과가 일치하지 않습니다.');
            setTemplateCreatorId(null);
            return;
          }
          const board = parseSnapshotDataToBoard(res.snapshotData as Record<string, unknown>);
          if (!board) {
            setTemplateBanner('지원하지 않는 티어표 데이터입니다.');
            setTemplateCreatorId(null);
            return;
          }
          hydrateFromResultSnapshot({
            templateId: res.templateId,
            tiers: board.tiers,
            pool: board.pool,
            workspaceTemplateTitle: res.templateTitle,
            workspaceTemplateDescription: null,
            workspaceBoardSurface: board.workspaceBoardSurface,
          });
          setTemplateBanner(null);
          void getTemplate(res.templateId, useAuthStore.getState().accessToken ?? null)
            .then((detail) => {
              if (cancelled) return;
              useTierStore.getState().setWorkspaceTemplateMeta({
                title: detail.title,
                description: templateItemsDescription(detail.items),
              });
              setTemplateCreatorId(detail.creatorId ?? null);
              setTemplateLikeCount(detail.likeCount ?? 0);
              setTemplateViewCount(detail.viewCount ?? 0);
              setTemplateMyReaction(detail.myReaction ?? null);
            })
            .catch(() => {
              setTemplateCreatorId(null);
              setTemplateLikeCount(0);
              setTemplateViewCount(0);
            });
        } catch {
          if (!cancelled) {
            setTemplateBanner('티어 결과를 불러오지 못했습니다.');
            setTemplateCreatorId(null);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (!templateIdParam) {
      startTransition(() => setTemplateBanner(null));
      return;
    }

    const snap = useTierStore.getState();
    if (
      snap.tierAutoSaveIntent &&
      snap.templateId != null &&
      snap.templateId === templateIdParam
    ) {
      startTransition(() => setTemplateBanner(null));
      return;
    }

    let cancelled = false;
    startTransition(() => {
      setTemplateBanner('템플릿 불러오는 중…');
      setTemplateCreatorId(null);
    });
    void (async () => {
      try {
        const detail = await getTemplate(
          templateIdParam,
          useAuthStore.getState().accessToken ?? null,
        );
        if (cancelled) return;
        const pool = templatePayloadToTierItems(detail.items);
        if (pool.length === 0) {
          setTemplateBanner('템플릿에 아이템이 없습니다.');
          setTemplateCreatorId(null);
          return;
        }
        loadTemplateWorkspace({
          templateId: detail.id,
          pool,
          workspaceTemplateTitle: detail.title,
          workspaceTemplateDescription: templateItemsDescription(detail.items),
          boardConfig: detail.boardConfig ?? null,
        });
        setTemplateCreatorId(detail.creatorId ?? null);
        setTemplateLikeCount(detail.likeCount ?? 0);
        setTemplateViewCount(detail.viewCount ?? 0);
        setTemplateMyReaction(detail.myReaction ?? null);
        setTemplateBanner(null);
      } catch {
        if (!cancelled) {
          setTemplateBanner('템플릿을 불러오지 못했습니다. 링크를 확인해 주세요.');
          setTemplateCreatorId(null);
          setTemplateLikeCount(0);
          setTemplateViewCount(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    templateIdParam,
    sourceResultIdParam,
    loadTemplateWorkspace,
    hydrateFromResultSnapshot,
    tierHydrated,
  ]);

  const isAdmin = me?.role === 'ADMIN';
  const isOwner =
    me != null && templateCreatorId != null && me.id === templateCreatorId;
  const showTemplateManage = Boolean(accessToken && templateId && (isOwner || isAdmin));

  return (
    <div ref={dragSelectRef} className="flex flex-col select-none bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">
      <header className="shrink-0 flex items-center justify-between gap-2 px-2 py-2 bg-slate-100 dark:bg-zinc-950 border-y border-slate-200 dark:border-zinc-800">
        <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300 shrink-0">템플릿</span>
        {templateBanner ? (
          <span className="text-xs text-amber-700 dark:text-amber-400 truncate min-w-0 text-right">
            {templateBanner}
          </span>
        ) : null}
      </header>

      <div
        className="shrink-0 bg-slate-100 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {templateId ? (
          <div className="px-3 sm:px-4 pt-2 pb-1.5 text-left">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
                    {workspaceTemplateTitle?.trim() || '템플릿'}
                  </h2>
                </div>
                {workspaceTemplateDescription?.trim() ? (
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400 whitespace-pre-wrap">
                    {workspaceTemplateDescription.trim()}
                  </p>
                ) : null}
              </div>
              {showTemplateManage ? (
                <div className="relative shrink-0 self-end sm:self-start" ref={headerMenuRef}>
                  <button
                    type="button"
                    onClick={() => setHeaderMenuOpen((v) => !v)}
                    aria-expanded={headerMenuOpen}
                    aria-haspopup="menu"
                    aria-label="템플릿 더 보기"
                    className={[
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                      headerMenuOpen
                        ? 'border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/40 text-slate-900 dark:text-zinc-100'
                        : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800',
                    ].join(' ')}
                  >
                    <MoreVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                  {headerMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-[100] mt-1 min-w-[9.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          setEditMetaOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                        수정
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div
          className={[
            'flex items-center justify-between gap-2 px-2 py-1.5',
            templateId ? 'border-t border-slate-200/70 dark:border-zinc-800/80' : '',
          ].join(' ')}
        >
          <div className="min-w-0 flex items-center">
            {templateId ? (
              <button type="button" onClick={() => void copyTemplateShareLink()} className={slimOutlineBtn}>
                🔗 템플릿 공유
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={[
                'text-xs px-2 py-1 rounded border font-medium',
                isFine
                  ? 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40'
                  : 'text-green-600 dark:text-green-400 border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/40',
              ].join(' ')}
            >
              {isFine ? '🖱 PC 모드' : '👆 터치 모드'}
            </span>
            <button type="button" onClick={resetBoard} className={slimOutlineBtn}>
              초기화
            </button>
          </div>
        </div>
      </div>

      <TierBoard
        dragSelectRef={dragSelectRef}
        pointerModeReady={deviceReady}
        allowLabelImageUpload={false}
        templateLikeSlot={
          templateId ? (
            <div className="flex shrink-0 items-center gap-2">
              <ViewCountInline count={templateViewCount} />
              <TemplateLikeButton
                templateId={templateId}
                initialLikeCount={templateLikeCount}
                initialMyReaction={templateMyReaction}
                onMyReactionResolved={setTemplateMyReaction}
                onLikeCountChange={setTemplateLikeCount}
              />
            </div>
          ) : null
        }
      />

      {templateId ? (
        <PopularTierResults
          key={templateId}
          templateId={templateId}
          currentUserId={me?.id ?? null}
          isAdmin={isAdmin}
          accessToken={accessToken}
        />
      ) : null}

      {templateId ? (
        <div className="shrink-0 border-t border-slate-200 bg-slate-50/90 px-3 py-4 dark:border-zinc-800 dark:bg-zinc-950/60 sm:px-4">
          <CommentSection
            targetType="TIER_TEMPLATE"
            targetId={templateId}
            currentUserId={me?.id ?? null}
          />
        </div>
      ) : null}

      {accessToken && templateId && editMetaOpen && (
        <TemplateEditMetaModal
          open
          onClose={() => setEditMetaOpen(false)}
          templateId={templateId}
          accessToken={accessToken}
          initialTitle={workspaceTemplateTitle?.trim() ?? ''}
          initialDescription={workspaceTemplateDescription?.trim() ?? ''}
          onSaved={(u) => {
            useTierStore.getState().setWorkspaceTemplateMeta({
              title: u.title,
              description: u.description ?? null,
            });
            toast.success('저장했어요.');
          }}
        />
      )}

      {accessToken && templateId && deleteOpen && (
        <TemplateDeleteConfirmDialog
          open
          onClose={() => setDeleteOpen(false)}
          templateId={templateId}
          accessToken={accessToken}
          onDeleted={() => {
            setDeleteOpen(false);
            toast.success('삭제했어요.');
            router.push('/templates');
          }}
        />
      )}

      <ImagePreviewModal />
    </div>
  );
}

export function TierPageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col min-h-[40vh] items-center justify-center bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 text-sm">
          불러오는 중…
        </div>
      }
    >
      <TierPageInner />
    </Suspense>
  );
}
