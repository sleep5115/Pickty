'use client';

import { useState } from 'react';
import { Dices, Undo2, Zap } from 'lucide-react';
import {
  useWorldCupStore,
  type WorldCupItem,
  type WorldCupLayoutMode,
} from '@/lib/store/worldcup-store';

const pillCounter =
  'rounded-full border border-zinc-300 bg-white/90 px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg backdrop-blur-sm tabular-nums dark:border-white/15 dark:bg-black/55 dark:text-white';

const tieBtn =
  'rounded-full border border-amber-400/50 bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-amber-600 dark:border-amber-300/40 dark:bg-amber-600/95 dark:hover:bg-amber-500';

const dropBtn =
  'rounded-full border border-rose-400/55 bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-rose-600 dark:border-rose-300/50 dark:bg-rose-600/95 dark:hover:bg-rose-500';

const selectMainA =
  'flex min-h-0 flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-rose-600 via-red-500 to-pink-500 px-2 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40 sm:text-sm';

const selectMainB =
  'flex min-h-0 flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-2 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40 sm:text-sm';

const rerollIconBtn =
  'flex size-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-zinc-100 text-zinc-900 shadow-sm transition hover:bg-zinc-200 disabled:opacity-40 dark:border-white/25 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700';

const undoBtn =
  'inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white/90 px-3 py-2 text-xs font-medium text-zinc-900 shadow-lg backdrop-blur-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:bg-black/50 dark:text-white dark:hover:bg-black/65 sm:text-sm';

interface WorldCupPlayClientProps {
  templateId: string;
}

export function WorldCupPlayClient({ templateId }: WorldCupPlayClientProps) {
  const [topCard, setTopCard] = useState<'A' | 'B'>('A');

  const rerollItem = useWorldCupStore((s) => s.rerollItem);
  const selectWinner = useWorldCupStore((s) => s.selectWinner);
  const dropBoth = useWorldCupStore((s) => s.dropBoth);
  const keepBoth = useWorldCupStore((s) => s.keepBoth);
  const undo = useWorldCupStore((s) => s.undo);

  const layoutMode = useWorldCupStore((s) => s.layoutMode) as WorldCupLayoutMode;
  const reservePoolCount = useWorldCupStore((s) => s.reservePoolCount);
  const historyLen = useWorldCupStore((s) => s.history.length);
  const left = useWorldCupStore((s) => s.currentRoundBracket[0]);
  const right = useWorldCupStore((s) => s.currentRoundBracket[1]);
  const tournamentComplete = useWorldCupStore((s) => s.tournamentComplete);

  const cardShellDiagonal =
    'overflow-hidden rounded-2xl shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-200 transition-transform duration-300 hover:scale-[1.02] dark:shadow-black/40 dark:ring-white/10';

  const cardShellRow =
    'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-200 transition-transform duration-200 hover:scale-[1.01] dark:shadow-black/40 dark:ring-white/10';

  const zA = topCard === 'A' ? 'z-10' : 'z-0';
  const zB = topCard === 'B' ? 'z-10' : 'z-0';

  const playChrome = (
    <>
      <div className="absolute right-4 top-4 z-40 flex items-center gap-2 md:right-8 md:top-6">
        <button
          type="button"
          className={undoBtn}
          onClick={() => undo()}
          disabled={historyLen === 0}
          aria-label="한 수 되돌리기"
        >
          <Undo2 className="size-4 shrink-0 opacity-90" aria-hidden />
          <span className="hidden sm:inline">뒤로 가기</span>
        </button>
        <div className={`${pillCounter}`} aria-live="polite">
          남은 교체:{' '}
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">{reservePoolCount}</span>개
        </div>
      </div>

      <div className="pointer-events-none absolute left-4 top-4 z-40 max-w-[min(100%-12rem,calc(100vw-18rem))] md:left-8 md:top-6">
        <p className="text-base font-semibold leading-tight text-zinc-900 drop-shadow-sm dark:text-white md:text-lg">
          이상형 월드컵
        </p>
      </div>

      {/* 공통: 상·하단 중앙 고정 — 미디어와 계층 분리 (항상 카드 위 클릭 가능) */}
      <div className="pointer-events-none absolute left-1/2 top-[6.25rem] z-[45] -translate-x-1/2 md:top-28">
        <button
          type="button"
          className={`pointer-events-auto whitespace-nowrap ${tieBtn}`}
          onClick={(e) => {
            e.stopPropagation();
            keepBoth();
          }}
          disabled={tournamentComplete || (!left && !right)}
        >
          둘 다 올리기 (무승부)
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-8 left-1/2 z-[45] -translate-x-1/2">
        <button
          type="button"
          className={`pointer-events-auto whitespace-nowrap ${dropBtn}`}
          onClick={(e) => {
            e.stopPropagation();
            dropBoth();
          }}
          disabled={tournamentComplete || (!left && !right)}
        >
          둘 다 탈락
        </button>
      </div>
    </>
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
      data-template-id={templateId}
    >
      <div className="relative h-[calc(100vh-80px)] min-h-[600px] w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {playChrome}

        {layoutMode === 'split_diagonal' ? (
          <>
            <div
              className={`absolute left-0 top-0 z-0 h-[75%] w-[60%] ${cardShellDiagonal} ${zA}`}
              onMouseEnter={() => setTopCard('A')}
            >
              <CandidateCard
                side="A"
                item={left}
                rerollIndex={0}
                reservePoolCount={reservePoolCount}
                tournamentComplete={tournamentComplete}
                rerollItem={rerollItem}
                selectWinner={selectWinner}
                mediaFit="cover"
              />
            </div>
            <div
              className={`absolute bottom-0 right-0 z-0 h-[75%] w-[60%] ${cardShellDiagonal} ${zB}`}
              onMouseEnter={() => setTopCard('B')}
            >
              <CandidateCard
                side="B"
                item={right}
                rerollIndex={1}
                reservePoolCount={reservePoolCount}
                tournamentComplete={tournamentComplete}
                rerollItem={rerollItem}
                selectWinner={selectWinner}
                mediaFit="cover"
              />
            </div>
          </>
        ) : (
          <div className="flex h-full min-h-0 flex-row gap-3 px-4 pb-6 pt-24 sm:gap-4 md:px-6">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <CandidateCard
                side="A"
                item={left}
                rerollIndex={0}
                reservePoolCount={reservePoolCount}
                tournamentComplete={tournamentComplete}
                rerollItem={rerollItem}
                selectWinner={selectWinner}
                mediaFit="contain"
                rootClassName={cardShellRow}
              />
            </div>
            <div
              className="flex shrink-0 flex-col items-center justify-center px-2 text-zinc-500 dark:text-zinc-500"
              aria-hidden
            >
              <div className="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-4 shadow-inner dark:border-white/10 dark:bg-zinc-900/90">
                <Zap className="size-8 text-amber-500 drop-shadow-md dark:text-amber-400 sm:size-9" strokeWidth={2} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                  VS
                </span>
              </div>
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <CandidateCard
                side="B"
                item={right}
                rerollIndex={1}
                reservePoolCount={reservePoolCount}
                tournamentComplete={tournamentComplete}
                rerollItem={rerollItem}
                selectWinner={selectWinner}
                mediaFit="contain"
                rootClassName={cardShellRow}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateCard({
  side,
  item,
  rerollIndex,
  reservePoolCount,
  tournamentComplete,
  rerollItem,
  selectWinner,
  mediaFit,
  rootClassName,
}: {
  side: 'A' | 'B';
  item: WorldCupItem | undefined;
  rerollIndex: 0 | 1;
  reservePoolCount: number;
  tournamentComplete: boolean;
  rerollItem: (index: 0 | 1) => void;
  selectWinner: (index: 0 | 1) => void;
  mediaFit: 'cover' | 'contain';
  /** 사선 모드는 외부 래퍼에 스타일 있음 — 행 모드만 전달 */
  rootClassName?: string;
}) {
  const selectBtn = side === 'A' ? selectMainA : selectMainB;
  const outer = rootClassName ?? 'flex h-full min-h-0 flex-col';

  return (
    <div className={outer}>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-2xl bg-zinc-100 dark:bg-black">
        <WorldCupCardMedia item={item} fit={mediaFit} />
      </div>
      <div className="flex h-16 shrink-0 gap-2 rounded-b-2xl border-t border-zinc-200 bg-zinc-100 p-3 dark:border-white/10 dark:bg-zinc-900">
        <button
          type="button"
          className={rerollIconBtn}
          aria-label="이 아이템 교체 (리롤)"
          onClick={() => rerollItem(rerollIndex)}
          disabled={tournamentComplete || reservePoolCount === 0 || !item}
        >
          <Dices className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          className={selectBtn}
          onClick={() => selectWinner(rerollIndex)}
          disabled={tournamentComplete || !item}
        >
          <span className="truncate">{item?.name ?? '후보'} 선택 ✔</span>
        </button>
      </div>
    </div>
  );
}

function WorldCupCardMedia({
  item,
  fit,
}: {
  item: WorldCupItem | undefined;
  fit: 'cover' | 'contain';
}) {
  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover';
  if (!item) {
    return (
      <div className="absolute inset-0 flex min-h-[80px] items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900">
        대기
      </div>
    );
  }
  if (!item.imageUrl) {
    return (
      <div className="absolute inset-0 flex min-h-[80px] items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900">
        이미지 없음
      </div>
    );
  }
  return (
    <img
      src={item.imageUrl}
      alt=""
      className={`absolute inset-0 h-full w-full rounded-t-2xl ${fitClass}`}
      draggable={false}
    />
  );
}
