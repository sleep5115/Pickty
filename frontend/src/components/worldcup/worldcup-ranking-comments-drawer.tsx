'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { CommentSection } from '@/components/interaction/comment-section';

type DrawerProps = {
  templateId: string;
  currentUserId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * 월드컵 랭킹 전용 — Radix Dialog(`modal={false}`) 기반 논모달 PC 우측 드로어 / 모바일 바텀 시트.
 * 오버레이·스크롤 잠금·포커스 트랩 없음. 외부 클릭으로 닫히지 않게 해 랭킹 본문과 동시 상호작용 가능.
 * 내부 `overflow-y-auto`로 댓글 영역만 독립 스크롤합니다.
 */
export function WorldCupRankingCommentsDrawer({
  templateId,
  currentUserId,
  open,
  onOpenChange,
}: DrawerProps) {
  return (
    <Dialog.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content
          className={[
            'worldcup-comment-drawer-panel fixed z-[110] flex flex-col border border-zinc-200 bg-white shadow-2xl outline-none',
            'dark:border-zinc-700 dark:bg-zinc-950',
            /* 모바일: 바텀 시트 */
            'inset-x-0 bottom-0 max-h-[min(92dvh,720px)] w-full rounded-t-2xl border-b-0',
            /* 데스크톱: 우측 사이드 */
            'md:inset-x-auto md:bottom-0 md:left-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-full md:max-w-md md:rounded-none md:rounded-l-2xl md:border-b md:border-l md:border-t-0',
          ].join(' ')}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <Dialog.Title className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              댓글
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              이상형 월드컵 템플릿에 달린 댓글 목록입니다. 닫기 버튼으로 창을 닫을 수 있습니다.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="댓글 창 닫기"
              >
                <X className="size-5 shrink-0" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
              <CommentSection
                targetType="WORLDCUP_TEMPLATE"
                targetId={templateId}
                currentUserId={currentUserId}
                showHeading={false}
                className="rounded-none border-0 bg-transparent p-0 shadow-none dark:bg-transparent"
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type FabProps = {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
};

/** 랭킹 본문 위에 고정 — 논모달 드로어와 겹쳐도 조작 가능하도록 `z-[115]`(패널 `z-[110]`보다 위) */
export function WorldCupRankingCommentsFab({ drawerOpen, onToggleDrawer }: FabProps) {
  return (
    <button
      type="button"
      onClick={onToggleDrawer}
      aria-haspopup="dialog"
      aria-expanded={drawerOpen}
      aria-label={drawerOpen ? '댓글 창 닫기' : '댓글 창 열기'}
      className={[
        'fixed z-[115] inline-flex items-center gap-2 rounded-full border border-primary/35',
        'bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))]',
        'bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25',
        'transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'dark:focus-visible:ring-offset-zinc-950',
      ].join(' ')}
    >
      <span className="text-lg leading-none" aria-hidden>
        💬
      </span>
      <span>{drawerOpen ? '댓글 닫기' : '댓글 보기'}</span>
    </button>
  );
}
