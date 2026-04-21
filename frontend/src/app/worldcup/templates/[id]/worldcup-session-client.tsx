'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { submitWorldCupPlayResult } from '@/lib/worldcup/worldcup-play-result-api';
import {
  fetchWorldCupTemplate,
  type WorldCupTemplateDetailDto,
} from '@/lib/worldcup/worldcup-template-api';
import {
  parseWorldCupItemsPayload,
  parseWorldCupLayoutMode,
} from '@/lib/worldcup/worldcup-template-items';
import type { WorldCupItem, WorldCupLayoutMode } from '@/lib/store/worldcup-store';
import { useWorldCupStore } from '@/lib/store/worldcup-store';
import { WorldCupPlayClient } from './worldcup-play-client';
import { WorldCupRankingClient } from './worldcup-ranking-client';
import { WorldCupResultClient } from './worldcup-result-client';

interface Props {
  templateId: string;
}

type LoadPhase = 'loading' | 'error' | 'ready';

export function WorldCupSessionClient({ templateId }: Props) {
  const reset = useWorldCupStore((s) => s.reset);
  const initialize = useWorldCupStore((s) => s.initialize);
  const champion = useWorldCupStore((s) => s.champion);
  const tournamentComplete = useWorldCupStore((s) => s.tournamentComplete);

  const [phase, setPhase] = useState<LoadPhase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showRanking, setShowRanking] = useState(false);
  const resultsSubmittedRef = useRef(false);

  /** 재시작 시 동일 세션 데이터로 초기화 */
  const sessionRef = useRef<{ items: WorldCupItem[]; layout: WorldCupLayoutMode } | null>(null);
  const aliveRef = useRef(true);

  const loadTemplate = useCallback(async () => {
    if (!aliveRef.current) return;
    setPhase('loading');
    setLoadError(null);
    resultsSubmittedRef.current = false;

    const res = await fetchWorldCupTemplate(templateId);
    if (!aliveRef.current) return;
    if (!res.ok) {
      const msg =
        res.status === 404
          ? '템플릿을 찾을 수 없습니다.'
          : `템플릿을 불러오지 못했습니다. (${res.status})`;
      setLoadError(msg);
      setPhase('error');
      return;
    }

    const data = (await res.json()) as WorldCupTemplateDetailDto;
    if (!aliveRef.current) return;
    const items = parseWorldCupItemsPayload(data.items);
    if (items.length < 1) {
      setLoadError('플레이할 아이템이 없습니다.');
      setPhase('error');
      return;
    }

    const layout = parseWorldCupLayoutMode(data.layoutMode);
    sessionRef.current = { items, layout };
    reset();
    initialize(items, 128, { layoutMode: layout });
    if (!aliveRef.current) return;
    setPhase('ready');
  }, [templateId, reset, initialize]);

  useEffect(() => {
    aliveRef.current = true;
    queueMicrotask(() => {
      void loadTemplate();
    });
    return () => {
      aliveRef.current = false;
      reset();
    };
  }, [loadTemplate, reset]);

  useEffect(() => {
    if (phase !== 'ready') return;
    if (!tournamentComplete || !champion) return;
    if (resultsSubmittedRef.current) return;
    resultsSubmittedRef.current = true;
    const state = useWorldCupStore.getState();
    void submitWorldCupPlayResult({
      templateId,
      winnerItemId: champion.id,
      matchHistory: state.matchHistory,
      itemStats: state.itemStats,
    }).then((res) => {
      if (!res.ok) resultsSubmittedRef.current = false;
    });
  }, [phase, templateId, tournamentComplete, champion]);

  const handleRestart = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    resultsSubmittedRef.current = false;
    initialize(s.items, 128, { layoutMode: s.layout });
    setShowRanking(false);
  }, [initialize]);

  if (phase === 'loading') {
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
        <Loader2 className="size-10 animate-spin text-violet-600 dark:text-violet-400" aria-hidden />
        <p className="text-sm font-medium">템플릿을 불러오는 중…</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 dark:bg-zinc-950">
        <p className="text-center text-sm text-rose-600 dark:text-rose-400">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadTemplate()}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-500"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (showRanking) {
    return (
      <WorldCupRankingClient templateId={templateId} onBackToResult={() => setShowRanking(false)} />
    );
  }

  if (tournamentComplete && champion) {
    return (
      <WorldCupResultClient
        templateId={templateId}
        champion={champion}
        onRestart={handleRestart}
        onShowRanking={() => setShowRanking(true)}
      />
    );
  }

  return <WorldCupPlayClient templateId={templateId} />;
}
