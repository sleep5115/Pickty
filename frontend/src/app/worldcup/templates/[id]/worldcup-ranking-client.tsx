'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, Loader2 } from 'lucide-react';
import { fetchWorldCupTemplate, type WorldCupTemplateDetailDto } from '@/lib/worldcup/worldcup-template-api';
import { parseWorldCupItemsPayload } from '@/lib/worldcup/worldcup-template-items';
import {
  fetchWorldCupRanking,
  WORLDCUP_RANKING_PAGE_SIZE,
  type WorldCupRankingRowDto,
} from '@/lib/worldcup/worldcup-ranking-api';
import { WorldCupListRasterThumb } from '@/components/worldcup/worldcup-list-raster-thumb';
import {
  WorldCupRankingCommentsDrawer,
  WorldCupRankingCommentsFab,
} from '@/components/worldcup/worldcup-ranking-comments-drawer';
import { WorldCupUrlAccordionMedia } from '@/components/worldcup/worldcup-url-media';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useAuthStore } from '@/lib/store/auth-store';

type RankingDenseMetricTone = 'primary' | 'sky' | 'amber' | 'rose';

function RankingDenseMetricBar({
  label,
  valuePct,
  fractionCaption,
  tone,
  ariaLabel,
}: {
  label: string;
  valuePct: number;
  /** 예: `3 / 40` */
  fractionCaption: string;
  tone: RankingDenseMetricTone;
  ariaLabel: string;
}) {
  const w = Math.min(100, Math.max(0, valuePct));
  const bar =
    tone === 'primary'
      ? 'bg-primary shadow-[0_0_8px_rgba(124,58,237,0.22)] dark:shadow-[0_0_10px_rgba(167,139,250,0.18)]'
      : tone === 'amber'
        ? 'bg-amber-500 dark:bg-amber-500/90'
        : tone === 'rose'
          ? 'bg-rose-500 dark:bg-rose-500/85'
          : 'bg-sky-500 dark:bg-sky-500/85';
  return (
    <div className="mx-auto flex w-full max-w-[12rem] flex-col gap-0.5">
      <div className="flex min-w-0 flex-nowrap items-start justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-500">
        <span className="min-w-0 flex-1 truncate text-left font-medium leading-snug" title={label}>
          {label}
        </span>
        <span className="shrink-0 text-right tabular-nums text-sm font-semibold leading-snug text-zinc-800 dark:text-zinc-200">
          {w}%
          <span className="ml-1.5 text-[11px] font-normal tabular-nums text-zinc-500 dark:text-zinc-500">
            ({fractionCaption})
          </span>
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-valuenow={Math.round(w)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
      >
        <div className={`h-full rounded-full transition-[width] duration-300 ease-out ${bar}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function formatStatFraction(numerator: number, denominator: number): string {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return '—';
  }
  return `${numerator} / ${denominator}`;
}

/** 백엔드 `pct` 와 동일: 반올림 0–100% */
function statPctRounded(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

/** 랭킹 표 행 — 지표 3줄·썸네일 열이 동일 최소 높이를 갖도록 맞춤 */
const RANKING_ROW_CELL_MIN_H = 'min-h-[6.25rem]';

function RankingMetricsHintLine() {
  return (
    <p className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50/90 px-4 py-2.5 text-sm leading-relaxed text-zinc-700 dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-300">
      지표 안내: 종합 승률은 우승·결승 진출·1:1 맞대결 승률을, 단계별 진출률은 해당 N강 이상(승리)으로 진출한 횟수를 이 템플릿의 완료 플레이 수 기준으로 보여 줍니다. 우측
      Pickty 지표는 맞대결 슬롯에서의 스킵·광탈·접전 비율입니다.
    </p>
  );
}

interface Props {
  templateId: string;
  onBackToResult: () => void;
  /** 결과 화면에서 온 경우 vs `/ranking` 직링크 등 — 뒤로 가기 동작에 맞는 라벨 */
  backNavLabel: string;
}

function buildItemMeta(itemsPayload: unknown): Map<string, { name: string; imageUrl?: string }> {
  const list = parseWorldCupItemsPayload(
    itemsPayload as Record<string, unknown> | unknown[] | null | undefined,
  );
  const m = new Map<string, { name: string; imageUrl?: string }>();
  for (const it of list) {
    m.set(String(it.id), { name: it.name, imageUrl: it.imageUrl });
  }
  return m;
}

function isAbortLike(e: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError') ||
    (e !== null && typeof e === 'object' && (e as { name?: string }).name === 'AbortError')
  );
}

export function WorldCupRankingClient({ templateId, onBackToResult, backNavLabel }: Props) {
  const authHydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [meId, setMeId] = useState<number | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [rows, setRows] = useState<WorldCupRankingRowDto[]>([]);
  const [itemMeta, setItemMeta] = useState<Map<string, { name: string; imageUrl?: string }>>(new Map());
  /** `championshipRatePct` 분모 — 템플릿 전체 완료 플레이 수 (백엔드 `totalCompletedPlays`) */
  const [totalCompletedPlays, setTotalCompletedPlays] = useState(0);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const aliveRef = useRef(true);
  const hasMoreRef = useRef(false);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const nextPageRef = useRef(0);
  const loadingRef = useRef(false);
  /** 초기 로드 겹침(Strict Mode 이중 마운트 등) 시 이전 요청의 finally가 loadingRef를 건드리지 않게 함 */
  const initialLoadSeqRef = useRef(0);

  const loadInitial = useCallback(async (signal?: AbortSignal) => {
    const mySeq = ++initialLoadSeqRef.current;
    const stale = () =>
      signal?.aborted === true || !aliveRef.current || initialLoadSeqRef.current !== mySeq;
    loadingRef.current = true;
    setPhase('loading');
    setErrorMessage(null);
    setLoadMoreError(null);
    setExpandedItemId(null);
    setTotalCompletedPlays(0);
    setLoadingMore(false);
    setHasMore(false);
    hasMoreRef.current = false;
    nextPageRef.current = 0;
    try {
      const tplRes = await fetchWorldCupTemplate(templateId, { signal });
      if (stale()) return;

      if (!tplRes.ok) {
        setErrorMessage(
          tplRes.status === 404 ? '템플릿을 찾을 수 없습니다.' : `템플릿 조회 실패 (${tplRes.status})`,
        );
        setPhase('error');
        return;
      }

      const tplJson = (await tplRes.json()) as WorldCupTemplateDetailDto;
      if (stale()) return;
      const itemsPayload = (tplJson.items ?? {}) as Record<string, unknown>;
      setItemMeta(buildItemMeta(itemsPayload));

      let rankData;
      try {
        rankData = await fetchWorldCupRanking(templateId, 0, WORLDCUP_RANKING_PAGE_SIZE, { signal });
      } catch (e) {
        if (stale() || isAbortLike(e)) return;
        setErrorMessage('랭킹을 불러올 수 없습니다.');
        setPhase('error');
        return;
      }
      if (stale()) return;

      setRows(rankData.content);
      setTotalCompletedPlays(rankData.totalCompletedPlays);
      const more = !rankData.last;
      setHasMore(more);
      hasMoreRef.current = more;
      nextPageRef.current = rankData.number + 1;
      setPhase('ready');
    } catch (e) {
      if (stale() || isAbortLike(e)) return;
      setErrorMessage('네트워크 오류가 발생했습니다.');
      setPhase('error');
    } finally {
      if (mySeq === initialLoadSeqRef.current) {
        loadingRef.current = false;
      }
    }
  }, [templateId]);

  const fetchNextPage = useCallback(async () => {
    if (!aliveRef.current || loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const pageToLoad = nextPageRef.current;
      const data = await fetchWorldCupRanking(templateId, pageToLoad, WORLDCUP_RANKING_PAGE_SIZE);
      if (!aliveRef.current) return;
      setRows((prev) => [...prev, ...data.content]);
      if (data.totalCompletedPlays > 0) {
        setTotalCompletedPlays(data.totalCompletedPlays);
      }
      const more = !data.last;
      setHasMore(more);
      hasMoreRef.current = more;
      nextPageRef.current = data.number + 1;
    } catch {
      if (!aliveRef.current) return;
      setLoadMoreError('다음 랭킹을 불러오지 못했습니다.');
    } finally {
      if (!aliveRef.current) return;
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [templateId]);

  useEffect(() => {
    aliveRef.current = true;
    const ac = new AbortController();
    void loadInitial(ac.signal);
    return () => {
      ac.abort();
      aliveRef.current = false;
    };
  }, [loadInitial]);

  useEffect(() => {
    if (!authHydrated || !accessToken) {
      queueMicrotask(() => setMeId(null));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok || cancelled) return;
        const u = (await res.json()) as { id?: unknown };
        const mid = typeof u.id === 'number' ? u.id : Number(u.id);
        if (Number.isFinite(mid)) setMeId(mid);
      } catch {
        if (!cancelled) setMeId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHydrated, accessToken]);

  useEffect(() => {
    if (phase !== 'ready' || !hasMoreRef.current) return;
    const el = sentinelRef.current;
    if (!el) return;
    /**
     * 레이아웃은 `layout.tsx` 기준 **문서(페이지) 전체 스크롤**이 흔함.
     * `root`를 내부 overflow div에 두면 window 스크롤 시 교차가 갱신되지 않아 다음 페이지가 영원히 안 불림.
     * 티어 피드(`/tier/results`)와 같이 root는 뷰포트(기본값)로 둔다.
     */
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit || loadingRef.current || !hasMoreRef.current || !aliveRef.current) return;
        void fetchNextPage();
      },
      { root: null, rootMargin: '0px', threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [phase, hasMore, fetchNextPage, rows.length]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
      data-template-id={templateId}
    >
      <div className="border-b border-zinc-200 bg-zinc-50/95 py-4 dark:border-white/10 dark:bg-zinc-900/80">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 sm:px-6 md:px-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-300/70 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-400/30">
              <BarChart3 className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 sm:min-w-[12rem]">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                이상형 월드컵
              </p>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">통계 랭킹</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={onBackToResult}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-200 dark:border-white/15 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 sm:self-auto"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {backNavLabel}
          </button>
        </div>
      </div>

      <div
        ref={scrollRootRef}
        className="mx-auto w-full max-w-[1600px] flex-1 overflow-auto px-4 py-6 sm:px-6 md:px-8 md:py-8"
      >
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-500 dark:text-zinc-400">
            <Loader2 className="size-9 animate-spin text-violet-600 dark:text-violet-400" aria-hidden />
            <p className="text-sm font-medium">랭킹을 불러오는 중…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-center text-sm text-rose-600 dark:text-rose-400">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void loadInitial(undefined)}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-500"
            >
              다시 시도
            </button>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <RankingMetricsHintLine />

            {totalCompletedPlays === 0 && rows.length > 0 ? (
              <div
                role="status"
                className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100"
              >
                아직 이 템플릿으로 끝까지 완료된 플레이가 없어요. 한 판을 끝까지 완료하면 비율이 집계됩니다. 아래는 템플릿
                후보 전체이며, 아직 맞대결에 나오지 않은 후보는 0%로 표시됩니다.
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50/80 shadow-inner ring-1 ring-zinc-200/80 dark:border-white/10 dark:bg-zinc-900/35 dark:ring-white/5">
              <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-[33%]" />
                  <col className="w-[21%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-100/95 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-500">
                    <th className="px-1 py-4 text-center">순위</th>
                    <th className="px-3 py-4 pr-2 text-center">후보</th>
                    <th className="min-w-[184px] px-2 py-4 text-center">종합 승률</th>
                    <th className="min-w-[184px] px-2 py-4 text-center">단계별 진출률</th>
                    <th className="min-w-[184px] px-2 py-4 text-center">Pickty 지표</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-zinc-500 dark:text-zinc-500">
                        템플릿에 후보가 없거나, 집계할 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    rows.flatMap((row) => {
                      const meta = itemMeta.get(String(row.itemId));
                      const name = meta?.name ?? String(row.itemId);
                      const imageUrl = meta?.imageUrl?.trim() ?? '';
                      const expanded = expandedItemId === row.itemId;

                      const headerRow = (
                        <tr
                          key={row.itemId}
                          role="button"
                          tabIndex={0}
                          aria-expanded={expanded}
                          onClick={() =>
                            setExpandedItemId((id) => (id === row.itemId ? null : row.itemId))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setExpandedItemId((id) => (id === row.itemId ? null : row.itemId));
                            }
                          }}
                          className="border-b border-zinc-200 odd:bg-white/80 hover:bg-zinc-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-500 dark:border-white/5 dark:odd:bg-black/15 dark:hover:bg-white/[0.03] cursor-pointer"
                        >
                          <td className="h-px px-1 py-4 align-middle">
                            <div
                              className={`flex h-full min-h-0 items-center justify-center ${RANKING_ROW_CELL_MIN_H}`}
                            >
                              <span className="text-center font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-500">
                                {row.rank}
                              </span>
                            </div>
                          </td>
                          <td className="h-px px-3 py-4 pr-2 align-middle">
                            {/*
                              `h-px` 셀: 형제 열(지표)이 행 높이를 정하면 이 셀도 같은 높이로 늘어나고,
                              썸네일·이름을 한 줄에서 수직 가운데 맞춤.
                            */}
                            <div className={`flex h-full min-h-0 items-center gap-2.5 ${RANKING_ROW_CELL_MIN_H}`}>
                              <div className="flex h-[min(6.5rem,28vw)] w-[min(6.5rem,28vw)] shrink-0 items-center justify-center">
                                {imageUrl ? (
                                  <WorldCupListRasterThumb
                                    rawUrl={imageUrl}
                                    alt=""
                                    className="size-full rounded-md bg-zinc-200 object-cover ring-1 ring-zinc-300 aspect-square dark:bg-zinc-800 dark:ring-white/10"
                                  />
                                ) : (
                                  <div className="flex size-full items-center justify-center rounded-md bg-zinc-200 text-[10px] text-zinc-500 ring-1 ring-zinc-300 dark:bg-zinc-800 dark:ring-white/10">
                                    없음
                                  </div>
                                )}
                              </div>
                              <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-zinc-900 line-clamp-3 dark:text-white">
                                {name}
                              </span>
                            </div>
                          </td>
                          <td className="h-px px-2 py-4 text-center align-top tabular-nums text-zinc-800 dark:text-zinc-200">
                            <div
                              className={`flex h-full min-h-0 w-full min-w-0 flex-col items-center gap-1.5 ${RANKING_ROW_CELL_MIN_H}`}
                            >
                              <RankingDenseMetricBar
                                label="우승 비율"
                                valuePct={row.championshipRatePct}
                                fractionCaption={formatStatFraction(row.finalWinCount, totalCompletedPlays)}
                                tone="primary"
                                ariaLabel={`우승 비율 ${row.championshipRatePct}%`}
                              />
                              <RankingDenseMetricBar
                                label="결승 진출"
                                valuePct={statPctRounded(row.reachedFinalCount, totalCompletedPlays)}
                                fractionCaption={formatStatFraction(row.reachedFinalCount, totalCompletedPlays)}
                                tone="primary"
                                ariaLabel={`결승 진출 ${statPctRounded(row.reachedFinalCount, totalCompletedPlays)}%`}
                              />
                              <RankingDenseMetricBar
                                label="1:1 승률"
                                valuePct={row.winRatePct}
                                fractionCaption={formatStatFraction(row.winCount, row.matchCount)}
                                tone="primary"
                                ariaLabel={`1대1 승률 ${row.winRatePct}%`}
                              />
                            </div>
                          </td>
                          <td className="h-px px-2 py-4 text-center align-top tabular-nums text-zinc-800 dark:text-zinc-200">
                            <div
                              className={`flex h-full min-h-0 w-full min-w-0 flex-col items-center gap-1.5 ${RANKING_ROW_CELL_MIN_H}`}
                            >
                              <RankingDenseMetricBar
                                label="4강 진출"
                                valuePct={statPctRounded(row.reached4Count, totalCompletedPlays)}
                                fractionCaption={formatStatFraction(row.reached4Count, totalCompletedPlays)}
                                tone="sky"
                                ariaLabel={`4강 진출 ${statPctRounded(row.reached4Count, totalCompletedPlays)}%`}
                              />
                              <RankingDenseMetricBar
                                label="8강 진출"
                                valuePct={statPctRounded(row.reached8Count, totalCompletedPlays)}
                                fractionCaption={formatStatFraction(row.reached8Count, totalCompletedPlays)}
                                tone="sky"
                                ariaLabel={`8강 진출 ${statPctRounded(row.reached8Count, totalCompletedPlays)}%`}
                              />
                              <RankingDenseMetricBar
                                label="16강 진출"
                                valuePct={statPctRounded(row.reached16Count, totalCompletedPlays)}
                                fractionCaption={formatStatFraction(row.reached16Count, totalCompletedPlays)}
                                tone="sky"
                                ariaLabel={`16강 진출 ${statPctRounded(row.reached16Count, totalCompletedPlays)}%`}
                              />
                            </div>
                          </td>
                          <td className="h-px px-2 py-4 text-center align-top">
                            <div
                              className={`flex h-full min-h-0 w-full min-w-0 flex-col items-center gap-1.5 ${RANKING_ROW_CELL_MIN_H}`}
                            >
                              <RankingDenseMetricBar
                                label="스킵률 (리롤)"
                                valuePct={row.skipRatePct}
                                fractionCaption={formatStatFraction(row.rerolledCount, row.matchCount)}
                                tone="amber"
                                ariaLabel={`스킵률 ${row.skipRatePct}%`}
                              />
                              <RankingDenseMetricBar
                                label="광탈률 (둘 다 탈락)"
                                valuePct={row.dropRatePct}
                                fractionCaption={formatStatFraction(row.droppedCount, row.matchCount)}
                                tone="rose"
                                ariaLabel={`광탈률 ${row.dropRatePct}%`}
                              />
                              <RankingDenseMetricBar
                                label="접전률 (둘 다 올림)"
                                valuePct={row.nailBiterRatePct}
                                fractionCaption={formatStatFraction(row.keptBothCount, row.matchCount)}
                                tone="sky"
                                ariaLabel={`접전률 ${row.nailBiterRatePct}%`}
                              />
                            </div>
                          </td>
                        </tr>
                      );

                      if (!expanded) {
                        return [headerRow];
                      }

                      const detailRow = (
                        <tr
                          key={`${row.itemId}-detail`}
                          className="border-b border-zinc-200 odd:bg-white/80 dark:border-white/5 dark:odd:bg-black/15"
                        >
                          <td colSpan={5} className="p-0">
                            <div className="overflow-hidden border-t border-zinc-200 bg-zinc-50/95 dark:border-white/10 dark:bg-zinc-900/60">
                              <div className="worldcup-ranking-panel-in px-4 py-5 sm:px-6">
                                {imageUrl ? (
                                  <WorldCupUrlAccordionMedia url={imageUrl} name={name} />
                                ) : (
                                  <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                                    표시할 미디어 URL이 없습니다.
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );

                      return [headerRow, detailRow];
                    })
                  )}
                </tbody>
              </table>
            </div>

            {hasMore ? (
              <div ref={sentinelRef} className="h-4 w-full shrink-0" aria-hidden />
            ) : null}

            {loadMoreError ? (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-rose-200/80 bg-rose-50/90 px-4 py-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/35 dark:text-rose-100">
                <p>{loadMoreError}</p>
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-500"
                >
                  다시 시도
                </button>
              </div>
            ) : null}

            {loadingMore ? (
              <div className="flex justify-center py-6">
                <div className="size-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              </div>
            ) : null}
          </>
        )}
      </div>

      {phase === 'ready' ? (
        <>
          <WorldCupRankingCommentsFab
            drawerOpen={commentsOpen}
            onToggleDrawer={() => setCommentsOpen((v) => !v)}
          />
          <WorldCupRankingCommentsDrawer
            templateId={templateId}
            currentUserId={meId}
            open={commentsOpen}
            onOpenChange={setCommentsOpen}
          />
        </>
      ) : null}
    </div>
  );
}
