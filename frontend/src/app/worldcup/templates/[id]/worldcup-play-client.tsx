'use client';

import { useRef, useState } from 'react';
import { Dices, Undo2, Volume2, VolumeX, Zap } from 'lucide-react';
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

  const tieDisabled = tournamentComplete || (!left && !right);

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

      {/*
       * 사선 레이아웃 전용 공통 버튼 — % 기반으로 빈 공간에 고정
       * 카드 A: left-0 top-0 w-[60%] h-[75%]
       * 카드 B: right-0 bottom-0 w-[60%] h-[75%]
       * 빈 우상단: left>60%, top<25% → right-[4%] top-[15%]
       * 빈 좌하단: left<40%, bottom<25% → left-[4%] bottom-[15%]
       */}
      {layoutMode === 'split_diagonal' ? (
        <>
          <button
            type="button"
            className={`absolute right-[4%] top-[15%] z-[45] whitespace-normal text-center ${tieBtn}`}
            onClick={(e) => {
              e.stopPropagation();
              keepBoth();
            }}
            disabled={tieDisabled}
          >
            둘 다 올리기 (무승부)
          </button>
          <button
            type="button"
            className={`absolute bottom-[15%] left-[4%] z-[45] whitespace-normal text-center ${dropBtn}`}
            onClick={(e) => {
              e.stopPropagation();
              dropBoth();
            }}
            disabled={tieDisabled}
          >
            둘 다 탈락
          </button>
        </>
      ) : null}
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
          <div className="flex h-full min-h-0 flex-row gap-2 px-4 pb-6 pt-24 sm:gap-3 md:px-6">
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
            <div className="flex w-[min(7.5rem,calc(100vw-2rem))] shrink-0 flex-col items-stretch justify-center gap-3 py-2 text-zinc-500 dark:text-zinc-500">
              <button
                type="button"
                className={`w-full shrink-0 whitespace-normal px-3 py-2.5 text-center text-xs font-semibold leading-snug sm:text-sm ${tieBtn}`}
                onClick={(e) => {
                  e.stopPropagation();
                  keepBoth();
                }}
                disabled={tieDisabled}
              >
                둘 다 올리기 (무승부)
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
                className={`w-full shrink-0 whitespace-normal px-3 py-2.5 text-center text-xs font-semibold leading-snug sm:text-sm ${dropBtn}`}
                onClick={(e) => {
                  e.stopPropagation();
                  dropBoth();
                }}
                disabled={tieDisabled}
              >
                둘 다 탈락
              </button>
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
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-2xl bg-black">
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
      <div className="absolute inset-0 flex min-h-[80px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        대기
      </div>
    );
  }
  if (!item.imageUrl?.trim()) {
    return (
      <div className="absolute inset-0 flex min-h-[80px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
        이미지 없음
      </div>
    );
  }

  const raw = item.imageUrl.trim();
  const kind = classifyWorldCupMediaUrl(raw);
  const videoId = parseYoutubeVideoId(raw);

  if (kind === 'youtube' && videoId) {
    return <WorldCupYouTubePlayer videoId={videoId} />;
  }

  /* 이미지: absolute inset-0 으로 부모 전체를 꽉 채운다 (레터박스 없음) */
  const imgSrc = picktyImageDisplaySrc(raw);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 외부·R2·동일출처 프록시 혼합
    <img
      src={imgSrc}
      alt=""
      className={`absolute inset-0 h-full w-full rounded-t-2xl ${fitClass}`}
      draggable={false}
    />
  );
}

/**
 * YouTube embed 는 크기와 무관하게 항상 상단 타이틀바(제목 + 우상단 뮤트/CC/설정)를 표시한다.
 * 이 컴포넌트는 iframe 을 위로 56px 밀어 타이틀바를 overflow-hidden 으로 클립하고,
 * 대신 좌하단에 직접 만든 뮤트 버튼을 배치한다.
 * enablejsapi=1 + postMessage 로 뮤트 상태를 iframe 에 전달한다.
 */
function WorldCupYouTubePlayer({ videoId }: { videoId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(false);

  const src = `${buildWorldCupYoutubePlayEmbedSrc(videoId)}&enablejsapi=1`;

  const toggleMute = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      JSON.stringify({ event: 'command', func: muted ? 'unMute' : 'mute', args: '' }),
      '*',
    );
    setMuted((prev) => !prev);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/*
       * marginTop: -56px → iframe 을 위로 56px 밀어 타이틀바를 overflow-hidden 영역 밖으로 보냄
       * height: calc(100% + 56px) → 하단 컨트롤바가 잘리지 않도록 높이를 56px 연장
       */}
      <div
        style={{ marginTop: '-56px', height: 'calc(100% + 56px)' }}
        className="flex justify-center"
      >
        <iframe
          ref={iframeRef}
          src={src}
          title=""
          className="h-full min-w-[640px] w-full shrink-0 border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      {/* 클립된 우상단 뮤트 버튼 대신 좌하단에 배치 */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute bottom-10 left-2 z-20 flex size-7 items-center justify-center rounded bg-black/60 text-white transition hover:bg-black/90"
        title={muted ? '음소거 해제' : '음소거'}
      >
        {muted ? (
          <VolumeX className="size-3.5" aria-hidden />
        ) : (
          <Volume2 className="size-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}
