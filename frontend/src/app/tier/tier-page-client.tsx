'use client';

import { Suspense, startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { TierBoard } from '@/components/tier/tier-board';
import { ImagePreviewModal } from '@/components/tier/image-preview-modal';
import { useTierStore } from '@/lib/store/tier-store';
import { useTierPersistHydrated } from '@/lib/hooks/use-tier-persist-hydrated';
import { usePointerDevice } from '@/hooks/use-pointer-device';
import {
  getTemplate,
  getTierResult,
  templateItemsDescription,
  templatePayloadToTierItems,
} from '@/lib/tier-api';
import { parseSnapshotDataToBoard } from '@/lib/tier-snapshot';

function TierPageInner() {
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get('templateId');
  const sourceResultIdParam = searchParams.get('sourceResultId');
  const loadTemplateWorkspace = useTierStore((s) => s.loadTemplateWorkspace);
  const hydrateFromResultSnapshot = useTierStore((s) => s.hydrateFromResultSnapshot);
  const tierHydrated = useTierPersistHydrated();

  const { clearTarget, resetBoard, setPreviewItem } = useTierStore();
  const templateId = useTierStore((s) => s.templateId);
  const workspaceTemplateTitle = useTierStore((s) => s.workspaceTemplateTitle);
  const workspaceTemplateDescription = useTierStore((s) => s.workspaceTemplateDescription);
  const { isPointerFine } = usePointerDevice();
  const [deviceReady, setDeviceReady] = useState(false);
  const isFine = deviceReady ? (isPointerFine ?? true) : true;

  const [templateBanner, setTemplateBanner] = useState<string | null>(null);

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
    if (!tierHydrated) return;

    if (sourceResultIdParam) {
      let cancelled = false;
      startTransition(() => {
        setTemplateBanner('티어표 불러오는 중…');
      });
      void (async () => {
        try {
          const res = await getTierResult(sourceResultIdParam);
          if (cancelled) return;
          if (templateIdParam && res.templateId !== templateIdParam) {
            setTemplateBanner('URL의 템플릿과 결과가 일치하지 않습니다.');
            return;
          }
          const board = parseSnapshotDataToBoard(res.snapshotData as Record<string, unknown>);
          if (!board) {
            setTemplateBanner('지원하지 않는 티어표 데이터입니다.');
            return;
          }
          hydrateFromResultSnapshot({
            templateId: res.templateId,
            tiers: board.tiers,
            pool: board.pool,
            workspaceTemplateTitle: res.templateTitle,
            workspaceTemplateDescription: null,
          });
          setTemplateBanner(null);
          void getTemplate(res.templateId)
            .then((detail) => {
              if (cancelled) return;
              useTierStore.getState().setWorkspaceTemplateMeta({
                title: detail.title,
                description: templateItemsDescription(detail.items),
              });
            })
            .catch(() => {});
        } catch {
          if (!cancelled) {
            setTemplateBanner('티어 결과를 불러오지 못했습니다.');
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
    startTransition(() => setTemplateBanner('템플릿 불러오는 중…'));
    void (async () => {
      try {
        const detail = await getTemplate(templateIdParam);
        if (cancelled) return;
        const pool = templatePayloadToTierItems(detail.items);
        if (pool.length === 0) {
          setTemplateBanner('템플릿에 아이템이 없습니다.');
          return;
        }
        loadTemplateWorkspace({
          templateId: detail.id,
          pool,
          workspaceTemplateTitle: detail.title,
          workspaceTemplateDescription: templateItemsDescription(detail.items),
        });
        setTemplateBanner(null);
      } catch {
        if (!cancelled) {
          setTemplateBanner('템플릿을 불러오지 못했습니다. 링크를 확인해 주세요.');
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
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
              {workspaceTemplateTitle?.trim() || '템플릿'}
            </h2>
            {workspaceTemplateDescription?.trim() ? (
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400 whitespace-pre-wrap">
                {workspaceTemplateDescription.trim()}
              </p>
            ) : null}
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

      <TierBoard dragSelectRef={dragSelectRef} pointerModeReady={deviceReady} />

      <ImagePreviewModal />

      <footer className="shrink-0 px-4 py-1.5 bg-slate-100/80 dark:bg-zinc-950/80 border-t border-slate-200 dark:border-zinc-800 text-center">
        <p className="text-xs text-slate-500 dark:text-zinc-600">
          {isFine ? (
            <>
              <span className="text-slate-600 dark:text-zinc-500">타겟팅:</span> 라벨 클릭 → 아이템 클릭
              &nbsp;|&nbsp;
              <span className="text-slate-600 dark:text-zinc-500">범위 선택:</span> 빈 공간 드래그
              &nbsp;|&nbsp;
              <span className="text-slate-600 dark:text-zinc-500">Ctrl+클릭:</span> 개별 추가 선택
              &nbsp;|&nbsp;
              <span className="text-slate-600 dark:text-zinc-500">Alt+클릭:</span> 이미지 확대 / 확대 중엔 닫기
              &nbsp;|&nbsp;
              <span className="text-slate-600 dark:text-zinc-500">확대:</span> ←→ 이전·다음
              &nbsp;|&nbsp;
              선택 후 드래그로 일괄 이동
            </>
          ) : (
            <>
              티어 라벨을 터치하여 활성화 → 아이템을 터치하면 이동 &nbsp;|&nbsp; 빈 공간 터치로 해제
              &nbsp;|&nbsp; 이미지 확대는 카드의 돋보기 · 확대 중 좌우 스와이프로 이전·다음
            </>
          )}
        </p>
      </footer>
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
