'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, Loader2, Skull, Swords } from 'lucide-react';
import { fetchWorldCupTemplate, type WorldCupTemplateDetailDto } from '@/lib/worldcup/worldcup-template-api';
import { parseWorldCupItemsPayload } from '@/lib/worldcup/worldcup-template-items';
import {
  fetchWorldCupRanking,
  type WorldCupRankingRowDto,
} from '@/lib/worldcup/worldcup-ranking-api';

function MiniBar({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'rose' | 'sky' }) {
  const bar =
    tone === 'amber'
      ? 'bg-amber-500 dark:bg-amber-500/90'
      : tone === 'rose'
        ? 'bg-rose-500 dark:bg-rose-500/85'
        : 'bg-sky-500 dark:bg-sky-500/85';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-600 dark:text-zinc-500">
        <span>{label}</span>
        <span className="tabular-nums text-sm font-semibold text-zinc-800 dark:text-zinc-200">{value}%</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-full rounded-full transition-[width] ${bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

interface Props {
  templateId: string;
  onBackToResult: () => void;
}

function buildItemMeta(
  itemsPayload: Record<string, unknown>,
): Map<string, { name: string; imageUrl?: string }> {
  const list = parseWorldCupItemsPayload(itemsPayload);
  const m = new Map<string, { name: string; imageUrl?: string }>();
  for (const it of list) {
    m.set(it.id, { name: it.name, imageUrl: it.imageUrl });
  }
  return m;
}

export function WorldCupRankingClient({ templateId, onBackToResult }: Props) {
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<WorldCupRankingRowDto[]>([]);
  const [itemMeta, setItemMeta] = useState<Map<string, { name: string; imageUrl?: string }>>(new Map());

  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    if (!aliveRef.current) return;
    setPhase('loading');
    setErrorMessage(null);
    try {
      const [rankRes, tplRes] = await Promise.all([
        fetchWorldCupRanking(templateId),
        fetchWorldCupTemplate(templateId),
      ]);
      if (!aliveRef.current) return;

      if (!tplRes.ok) {
        setErrorMessage(
          tplRes.status === 404 ? '템플릿을 찾을 수 없습니다.' : `템플릿 조회 실패 (${tplRes.status})`,
        );
        setPhase('error');
        return;
      }

      const tplJson = (await tplRes.json()) as WorldCupTemplateDetailDto;
      if (!aliveRef.current) return;
      setItemMeta(buildItemMeta(tplJson.items));

      if (!rankRes.ok) {
        setErrorMessage(
          rankRes.status === 404
            ? '랭킹을 불러올 수 없습니다.'
            : `랭킹 조회 실패 (${rankRes.status})`,
        );
        setPhase('error');
        return;
      }

      const rankingJson = (await rankRes.json()) as WorldCupRankingRowDto[];
      if (!aliveRef.current) return;
      setRows(Array.isArray(rankingJson) ? rankingJson : []);
      setPhase('ready');
    } catch {
      if (!aliveRef.current) return;
      setErrorMessage('네트워크 오류가 발생했습니다.');
      setPhase('error');
    }
  }, [templateId]);

  useEffect(() => {
    aliveRef.current = true;
    queueMicrotask(() => {
      void load();
    });
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
      data-template-id={templateId}
    >
      <div className="border-b border-zinc-200 bg-zinc-50/95 px-4 py-4 dark:border-white/10 dark:bg-zinc-900/80 sm:px-6 md:px-8">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-300/70 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-400/30">
              <BarChart3 className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                이상형 월드컵
              </p>
              <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-white">통계 랭킹</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={onBackToResult}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-200 dark:border-white/15 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 sm:self-auto"
          >
            <ArrowLeft className="size-4" aria-hidden />
            결과로 돌아가기
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1200px] flex-1 overflow-auto px-4 py-6 sm:px-6">
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
              onClick={() => void load()}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-500"
            >
              다시 시도
            </button>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50/80 shadow-inner ring-1 ring-zinc-200/80 dark:border-white/10 dark:bg-zinc-900/35 dark:ring-white/5">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-100/95 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-500">
                    <th className="px-5 py-4">순위 · 후보</th>
                    <th className="px-5 py-4">우승 비율</th>
                    <th className="px-5 py-4">승률 (1:1)</th>
                    <th className="min-w-[260px] px-5 py-4">Pickty 지표</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-zinc-500 dark:text-zinc-500">
                        아직 집계된 플레이가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const meta = itemMeta.get(row.itemId);
                      const name = meta?.name ?? row.itemId;
                      const imageUrl = meta?.imageUrl;

                      return (
                        <tr
                          key={row.itemId}
                          className="border-b border-zinc-200 last:border-0 odd:bg-white/80 hover:bg-zinc-100/90 dark:border-white/5 dark:odd:bg-black/15 dark:hover:bg-white/[0.03]"
                        >
                          <td className="px-5 py-5 align-middle">
                            <div className="flex items-center gap-4">
                              <span className="w-7 shrink-0 text-center font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-500">
                                {row.rank}
                              </span>
                              {imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- 랭킹 썸네일 URL
                                <img
                                  src={imageUrl}
                                  alt=""
                                  className="size-24 shrink-0 rounded-lg bg-zinc-200 object-cover ring-1 ring-zinc-300 dark:bg-zinc-800 dark:ring-white/10"
                                />
                              ) : (
                                <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-xs text-zinc-500 ring-1 ring-zinc-300 dark:bg-zinc-800 dark:ring-white/10">
                                  이미지 없음
                                </div>
                              )}
                              <span className="min-w-0 font-medium text-zinc-900 dark:text-white">{name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-5 align-middle tabular-nums text-zinc-800 dark:text-zinc-200">
                            <span className="text-base font-semibold">{row.championshipRatePct}%</span>
                            <span className="mt-1 block text-[11px] font-normal text-zinc-500 dark:text-zinc-500">
                              우승 / 전체 플레이 수
                            </span>
                          </td>
                          <td className="px-5 py-5 align-middle tabular-nums text-zinc-800 dark:text-zinc-200">
                            <span className="text-base font-semibold">{row.winRatePct}%</span>
                            <span className="mt-1 block text-[11px] font-normal text-zinc-500 dark:text-zinc-500">
                              승 / 대결 수
                            </span>
                          </td>
                          <td className="px-5 py-5 align-top">
                            <div className="flex max-w-md flex-col gap-3.5">
                              <MiniBar label="스킵률 (리롤당함)" value={row.skipRatePct} tone="amber" />
                              <MiniBar label="광탈률 (둘 다 탈락)" value={row.dropRatePct} tone="rose" />
                              <MiniBar label="접전률 (둘 다 올리기)" value={row.nailBiterRatePct} tone="sky" />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 text-xs text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-500 sm:grid-cols-3">
              <p className="flex gap-2">
                <Swords className="size-4 shrink-0 text-zinc-400 dark:text-zinc-600" aria-hidden />
                <span>
                  <strong className="text-zinc-800 dark:text-zinc-400">승률</strong> · 해당 후보가 이긴 횟수 ÷ 실제
                  맞대결 참가 수
                </span>
              </p>
              <p className="flex gap-2">
                <Skull className="size-4 shrink-0 text-zinc-400 dark:text-zinc-600" aria-hidden />
                <span>
                  <strong className="text-zinc-800 dark:text-zinc-400">광탈·접전</strong> · 라운드에서 두 후보 모두에게
                  적용되는 액션 비율
                </span>
              </p>
              <p className="flex gap-2">
                <BarChart3 className="size-4 shrink-0 text-zinc-400 dark:text-zinc-600" aria-hidden />
                <span>
                  <strong className="text-zinc-800 dark:text-zinc-400">우승 비율</strong> · 최종 우승 횟수 ÷ 완료된
                  플레이(게임) 총 횟수
                </span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
