'use client';

/**
 * 인게임 UI. 강수 선택·N명 출전·리롤 풀 분배 정책은 `WorldCupBracketSelect` +
 * `worldcupSelectableBracketSizes` + 스토어 `initialize`(셔플 후 N명 slice, 나머지 reserve)와 맞춘다.
 */

import { useState } from 'react';
import { Undo2, Zap } from 'lucide-react';
import {
  useWorldCupStore,
  type WorldCupItem,
  type WorldCupLayoutMode,
} from '@/lib/store/worldcup-store';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import {
  buildWorldCupYoutubePlayEmbedSrc,
  classifyWorldCupMediaUrl,
  parseYoutubeVideoId,
} from '@/lib/worldcup/worldcup-media-url';
import { formatWorldCupRoundLabel } from '@/lib/worldcup/worldcup-bracket-sizes';

const pillCounter =
  'rounded-full border border-zinc-300 bg-white/90 px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg backdrop-blur-sm tabular-nums dark:border-white/15 dark:bg-black/55 dark:text-white';

/** 플레이 영역 우상단 — 둘 다 올림 / 둘 다 탈락 */
const tieBtnUtility =
  'rounded-xl border border-amber-400/55 bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-amber-600 dark:border-amber-300/45 dark:bg-amber-600/95 dark:hover:bg-amber-500';

const dropBtnUtility =
  'rounded-xl border border-rose-400/60 bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 dark:border-rose-300/55 dark:bg-rose-600/95 dark:hover:bg-rose-500';

const selectMainA =
  'flex min-h-0 flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-rose-600 via-red-500 to-pink-500 px-2 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40 sm:text-sm';

const selectMainB =
  'flex min-h-0 flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-2 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40 sm:text-sm';

/** `frontend/public/worldcup/reroll-button.png` — 게임풍 리롤 버튼 에셋 */
const WORLD_CUP_REROLL_BTN_SRC = '/worldcup/reroll-button.png';

const rerollAssetBtn =
  'flex h-10 shrink-0 cursor-pointer items-center overflow-hidden rounded-md px-0 shadow-md transition hover:brightness-110 active:scale-[0.98]';

const undoBtn =
  'inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white/90 px-3 py-2 text-xs font-medium text-zinc-900 shadow-lg backdrop-blur-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:bg-black/50 dark:text-white dark:hover:bg-black/65 sm:text-sm';

interface WorldCupPlayProgressHeaderProps {
  templateTitle: string;
}

function WorldCupPlayProgressHeader({ templateTitle }: WorldCupPlayProgressHeaderProps) {
  const undo = useWorldCupStore((s) => s.undo);
  const historyLen = useWorldCupStore((s) => s.history.length);
  const reservePoolCount = useWorldCupStore((s) => s.reservePoolCount);
  const roundDisplayPlayerCount = useWorldCupStore((s) => s.roundDisplayPlayerCount);
  const roundPlayingInitialLength = useWorldCupStore((s) => s.roundPlayingInitialLength);
  const currentRoundLen = useWorldCupStore((s) => s.currentRoundBracket.length);

  const roundLabel =
    roundDisplayPlayerCount > 0 ? formatWorldCupRoundLabel(roundDisplayPlayerCount) : '준비';
  const totalMatches =
    roundPlayingInitialLength > 0 ? Math.max(1, roundPlayingInitialLength / 2) : 1;
  const currentMatch =
    roundPlayingInitialLength > 0
      ? Math.max(1, (roundPlayingInitialLength - currentRoundLen) / 2 + 1)
      : 1;
  const pct = Math.min(100, Math.max(0, (currentMatch / totalMatches) * 100));

  return (
    <header className="shrink-0 border-b border-zinc-200 bg-gradient-to-b from-white to-zinc-50/80 px-4 py-4 dark:border-white/10 dark:from-zinc-950 dark:to-zinc-950">
      <div className="mx-auto max-w-7xl space-y-4">
        <h1 className="px-2 text-center text-2xl font-extrabold leading-tight tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
          {templateTitle}
        </h1>

        <div className="flex justify-center px-2">
          <div className="flex w-full max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:gap-x-7">
            <button
              type="button"
              className={undoBtn}
              onClick={() => undo()}
              disabled={historyLen === 0}
              aria-label="한 수 되돌리기"
            >
              <Undo2 className="size-4 shrink-0 opacity-90" aria-hidden />
              <span className="hidden sm:inline">되돌리기</span>
            </button>

            <p className="flex flex-wrap items-baseline justify-center gap-2 text-lg font-bold text-zinc-800 dark:text-zinc-100">
              <span className="inline-flex items-center rounded-lg bg-primary/12 px-2.5 py-1 text-base font-extrabold text-primary ring-1 ring-primary/25 dark:bg-primary/20 dark:ring-primary/35">
                [{roundLabel}]
              </span>
              <span className="tabular-nums text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {currentMatch} / {totalMatches}
              </span>
            </p>

            <div
              className="h-4 min-w-[10rem] flex-1 basis-56 overflow-hidden rounded-full bg-zinc-200 shadow-inner dark:bg-zinc-800 sm:max-w-md sm:basis-auto"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`대진 진행 ${Math.round(pct)}%`}
            >
              <div
                className="h-full rounded-full bg-primary shadow-[0_0_12px_rgba(124,58,237,0.45)] transition-[width] duration-300 ease-out dark:shadow-[0_0_14px_rgba(167,139,250,0.35)]"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className={`${pillCounter}`} aria-live="polite">
              남은 리롤:{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">{reservePoolCount}</span>개
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

interface WorldCupPlayClientProps {
  templateId: string;
  templateTitle: string;
}

export function WorldCupPlayClient({ templateId, templateTitle }: WorldCupPlayClientProps) {
  const [topCard, setTopCard] = useState<'A' | 'B'>('A');

  const rerollItem = useWorldCupStore((s) => s.rerollItem);
  const selectWinner = useWorldCupStore((s) => s.selectWinner);
  const dropBoth = useWorldCupStore((s) => s.dropBoth);
  const keepBoth = useWorldCupStore((s) => s.keepBoth);
  const layoutMode = useWorldCupStore((s) => s.layoutMode) as WorldCupLayoutMode;
  const reservePoolCount = useWorldCupStore((s) => s.reservePoolCount);
  const left = useWorldCupStore((s) => s.currentRoundBracket[0]);
  const right = useWorldCupStore((s) => s.currentRoundBracket[1]);
  const tournamentComplete = useWorldCupStore((s) => s.tournamentComplete);

  const cardShellDiagonal =
    'overflow-hidden rounded-2xl shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-200 transition-transform duration-300 hover:scale-[1.02] dark:shadow-black/40 dark:ring-white/10';

  const cardShellRow =
    'relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-2xl shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-200 transition-transform duration-200 hover:scale-[1.01] dark:shadow-black/40 dark:ring-white/10';

  const zA = topCard === 'A' ? 'z-10' : 'z-0';
  const zB = topCard === 'B' ? 'z-10' : 'z-0';

  const tieDisabled = tournamentComplete || (!left && !right);

  const utilityActions = (
    <div className="pointer-events-auto absolute right-4 top-4 z-[45] flex gap-2">
      <button
        type="button"
        className={tieBtnUtility}
        title="둘 다 올림"
        onClick={(e) => {
          e.stopPropagation();
          keepBoth();
        }}
        disabled={tieDisabled}
      >
        둘 다 올림
      </button>
      <button
        type="button"
        className={dropBtnUtility}
        title="둘 다 탈락"
        onClick={(e) => {
          e.stopPropagation();
          dropBoth();
        }}
        disabled={tieDisabled}
      >
        둘 다 탈락
      </button>
    </div>
  );

  return (
    <div
      className="flex h-[calc(100dvh-16rem)] w-full flex-1 flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
      data-template-id={templateId}
    >
      <WorldCupPlayProgressHeader templateTitle={templateTitle} />
      {/*
       * Flex 상속 트리: flex-col 루트 → 헤더 shrink-0 아래 flex-1 플레이 영역만 세로 분배.
       */}
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {layoutMode === 'split_diagonal' ? utilityActions : null}

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
                mediaFit="contain"
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
                mediaFit="contain"
              />
            </div>
          </>
        ) : (
          <div className="flex min-h-0 w-full flex-1 flex-row gap-4 px-4 pb-6 pt-6">
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
            <div className="flex w-[min(7.5rem,calc(100vw-2rem))] shrink-0 flex-col items-stretch justify-center gap-3 py-2">
              <button
                type="button"
                className={`w-full shrink-0 whitespace-normal text-center ${tieBtnUtility}`}
                onClick={(e) => {
                  e.stopPropagation();
                  keepBoth();
                }}
                disabled={tieDisabled}
              >
                둘 다 올림
              </button>
              <div
                className="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-3 shadow-inner dark:border-white/10 dark:bg-zinc-900/90"
                aria-hidden
              >
                <Zap
                  className="size-7 text-amber-500 drop-shadow-md dark:text-amber-400 sm:size-8"
                  strokeWidth={2}
                />
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                  VS
                </span>
              </div>
              <button
                type="button"
                className={`w-full shrink-0 whitespace-normal text-center ${dropBtnUtility}`}
                onClick={(e) => {
                  e.stopPropagation();
                  dropBoth();
                }}
                disabled={tieDisabled}
              >
                둘 다 탈락
              </button>
            </div>
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
  const canReroll = !tournamentComplete && reservePoolCount > 0 && !!item;
  const outer =
    rootClassName ??
    'relative flex h-full min-h-0 w-full flex-col overflow-hidden';

  return (
    <div className={outer}>
      <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-t-2xl bg-black">
        <WorldCupCardMedia item={item} fit={mediaFit} />
      </div>
      <div className="mt-auto flex h-16 w-full shrink-0 gap-2 rounded-b-2xl border-t border-zinc-200 bg-zinc-100 p-3 dark:border-white/10 dark:bg-zinc-900">
        <button
          type="button"
          className={rerollAssetBtn}
          aria-label={canReroll ? '이 아이템 교체 (리롤)' : '리롤 불가 (남은 횟수 없음 또는 종료됨)'}
          aria-disabled={!canReroll}
          onClick={() => {
            if (!canReroll) return;
            rerollItem(rerollIndex);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 정적 퍼블릭 에셋, 버튼 전체 그래픽 */}
          <img
            src={WORLD_CUP_REROLL_BTN_SRC}
            alt=""
            width={160}
            height={40}
            className="h-10 w-auto max-w-[min(11rem,28vw)] select-none object-contain object-left"
            draggable={false}
          />
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
      <div className="absolute inset-0 flex items-center justify-center p-4 text-sm text-zinc-500 dark:text-zinc-400">
        대기
      </div>
    );
  }
  if (!item.imageUrl?.trim()) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-4 text-sm text-zinc-500 dark:text-zinc-400">
        이미지 없음
      </div>
    );
  }

  const raw = item.imageUrl.trim();
  const kind = classifyWorldCupMediaUrl(raw);
  const videoId = parseYoutubeVideoId(raw);

  if (kind === 'youtube' && videoId) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <WorldCupYouTubePlayer videoId={videoId} />
      </div>
    );
  }

  const imgSrc = picktyImageDisplaySrc(raw);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 외부·R2·동일출처 프록시 혼합
    <img
      src={imgSrc}
      alt=""
      className={`absolute inset-0 h-full w-full object-center p-4 drop-shadow-2xl ${fitClass}`}
      draggable={false}
    />
  );
}

/**
 * 플레이 카드 내 YouTube: 16:9 고정(aspect-video). 부모 WorldCupCardMedia 가 flex 중앙 정렬 래퍼를 제공한다.
 * iframe 에 h-full 단독 적용으로 비율 파괴·상하 클립되는 것을 피한다.
 */
function WorldCupYouTubePlayer({ videoId }: { videoId: string }) {
  const src = buildWorldCupYoutubePlayEmbedSrc(videoId);

  return (
    <div className="relative aspect-video w-full max-h-full max-w-full overflow-hidden rounded-lg shadow-lg">
      <iframe
        src={src}
        title=""
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
