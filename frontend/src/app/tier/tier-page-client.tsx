'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TierBoard } from '@/components/tier/tier-board';
import { ImagePreviewModal } from '@/components/tier/image-preview-modal';
import { useTierStore } from '@/lib/store/tier-store';
import { useTierPersistHydrated } from '@/lib/hooks/use-tier-persist-hydrated';
import { usePointerDevice } from '@/hooks/use-pointer-device';
import { getTemplate, templatePayloadToTierItems } from '@/lib/tier-api';

function TierPageInner() {
  const searchParams = useSearchParams();
  const templateIdParam = searchParams.get('templateId');
  const loadTemplateWorkspace = useTierStore((s) => s.loadTemplateWorkspace);
  const tierHydrated = useTierPersistHydrated();

  const { clearTarget, resetBoard, setPreviewItem } = useTierStore();
  const { isPointerFine } = usePointerDevice();
  const [deviceReady, setDeviceReady] = useState(false);
  const isFine = deviceReady ? (isPointerFine ?? true) : true;

  const [templateBanner, setTemplateBanner] = useState<string | null>(null);

  const dragSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDeviceReady(true);
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPreviewItem(null);
      clearTarget();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearTarget, setPreviewItem]);

  useEffect(() => {
    if (!templateIdParam) {
      setTemplateBanner(null);
      return;
    }
    if (!tierHydrated) return;

    const snap = useTierStore.getState();
    if (
      snap.tierAutoSaveIntent &&
      snap.templateId != null &&
      snap.templateId === templateIdParam
    ) {
      setTemplateBanner(null);
      return;
    }

    let cancelled = false;
    setTemplateBanner('템플릿 불러오는 중…');
    void (async () => {
      try {
        const detail = await getTemplate(templateIdParam);
        if (cancelled) return;
        const pool = templatePayloadToTierItems(detail.items);
        if (pool.length === 0) {
          setTemplateBanner('템플릿에 아이템이 없습니다.');
          return;
        }
        loadTemplateWorkspace({ templateId: detail.id, pool });
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
  }, [templateIdParam, loadTemplateWorkspace, tierHydrated]);

  return (
    <div ref={dragSelectRef} className="flex flex-col select-none bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">
      <header className="shrink-0 flex items-center justify-between px-2 py-2 bg-slate-100 dark:bg-zinc-950 border-y border-slate-200 dark:border-zinc-800">
        <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">티어표</span>

        <div className="flex items-center gap-2">
          {templateBanner && (
            <span className="text-xs text-amber-700 dark:text-amber-400 max-w-[min(280px,45vw)] truncate">
              {templateBanner}
            </span>
          )}
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

          <button
            onClick={resetBoard}
            className="text-sm px-3 py-1 rounded border border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:border-slate-400 dark:hover:border-zinc-500 transition-colors"
          >
            초기화
          </button>
        </div>
      </header>

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
