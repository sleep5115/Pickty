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
import {
  aggregateItemStatsFromMatchHistory,
  useWorldCupStore,
  type WorldCupItem,
  type WorldCupLayoutMode,
} from '@/lib/store/worldcup-store';
import { WorldCupBracketSelect } from '@/components/worldcup/worldcup-bracket-select';
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
  const leaveToBracketSelection = useWorldCupStore((s) => s.leaveToBracketSelection);
  const isPlaying = useWorldCupStore((s) => s.isPlaying);
  const champion = useWorldCupStore((s) => s.champion);
  const tournamentComplete = useWorldCupStore((s) => s.tournamentComplete);

  const [phase, setPhase] = useState<LoadPhase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showRanking, setShowRanking] = useState(false);
  const resultsSubmittedRef = useRef(false);

  /** 재시작 시 동일 세션 데이터로 초기화 */
  const sessionRef = useRef<{
    items: WorldCupItem[];
    layout: WorldCupLayoutMode;
    title: string;
  } | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
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
    const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : '이상형 월드컵';
    sessionRef.current = { items, layout, title };
    setTemplateTitle(title);
    reset();
    if (!aliveRef.current) return;
    setPhase('ready');
  }, [templateId, reset]);

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
    const winnerItemId = state.champion?.id ?? champion.id;
    const itemStats = aggregateItemStatsFromMatchHistory(state.matchHistory);
    // eslint-disable-next-line no-console -- 개발 중 제출 페이로드 확인용(임시)
    console.log('Submitting Worldcup Results:', { winnerItemId, itemStats });
    void submitWorldCupPlayResult({
      templateId,
      winnerItemId,
      matchHistory: state.matchHistory,
      itemStats,
    }).then((res) => {
      if (!res.ok) resultsSubmittedRef.current = false;
    });
  }, [phase, templateId, tournamentComplete, champion]);

  const handleRestart = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    resultsSubmittedRef.current = false;
    leaveToBracketSelection();
    setTemplateTitle(s.title);
    setShowRanking(false);
  }, [leaveToBracketSelection]);

  const handleBracketChosen = useCallback(
    (bracketSize: number) => {
      const s = sessionRef.current;
      if (!s) return;
      initialize(s.items, bracketSize, { layoutMode: s.layout });
    },
    [initialize],
  );

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

  if (phase === 'ready' && !isPlaying && sessionRef.current) {
    const total = sessionRef.current.items.length;
    return (
      <WorldCupBracketSelect
        templateTitle={templateTitle || sessionRef.current.title}
        totalItems={total}
        onSelectBracket={handleBracketChosen}
      />
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

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <WorldCupPlayClient templateId={templateId} templateTitle={templateTitle || '이상형 월드컵'} />
    </div>
  );
}
