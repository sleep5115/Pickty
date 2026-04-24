'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { submitWorldCupPlayResult } from '@/lib/worldcup/worldcup-play-result-api';
import {
  fetchWorldCupTemplate,
  parseWorldCupTemplateDetailReactionFields,
  type WorldCupTemplateDetailDto,
} from '@/lib/worldcup/worldcup-template-api';
import type { ReactionType } from '@/lib/api/interaction-api';
import {
  parseWorldCupItemsPayload,
  parseWorldCupLayoutMode,
} from '@/lib/worldcup/worldcup-template-items';
import {
  buildWorldCupStatSubmitPayload,
  useWorldCupStore,
  type WorldCupItem,
  type WorldCupLayoutMode,
} from '@/lib/store/worldcup-store';
import { WorldCupBracketSelect } from '@/components/worldcup/worldcup-bracket-select';
import { WorldCupPlayClient } from './worldcup-play-client';
import { WorldCupRankingClient } from './worldcup-ranking-client';
import { WorldCupResultClient } from './worldcup-result-client';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useAuthStore } from '@/lib/store/auth-store';

interface Props {
  templateId: string;
}

type LoadPhase = 'loading' | 'error' | 'ready';

export function WorldCupSessionClient({ templateId }: Props) {
  const authHydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
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
  /** 결과 화면 좋아요 — 랭킹 왕복·리마운트 후에도 서버·낙관적 상태와 맞춤 */
  const [templateLikeCount, setTemplateLikeCount] = useState(0);
  const [templateMyReaction, setTemplateMyReaction] = useState<ReactionType | null>(null);

  /** 재시작 시 동일 세션 데이터로 초기화 */
  const sessionRef = useRef<{
    items: WorldCupItem[];
    layout: WorldCupLayoutMode;
    title: string;
    likeCount: number;
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

    const raw = (await res.json()) as Record<string, unknown>;
    if (!aliveRef.current) return;
    const data = raw as unknown as WorldCupTemplateDetailDto;
    const items = parseWorldCupItemsPayload(
      data.items as Record<string, unknown> | unknown[] | null | undefined,
    );
    if (items.length < 1) {
      setLoadError('플레이할 아이템이 없습니다.');
      setPhase('error');
      return;
    }

    const layout = parseWorldCupLayoutMode(data.layoutMode);
    const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : '이상형 월드컵';
    const { likeCount, myReaction } = parseWorldCupTemplateDetailReactionFields(raw);
    sessionRef.current = { items, layout, title, likeCount };
    setTemplateLikeCount(likeCount);
    setTemplateMyReaction(myReaction);
    setTemplateTitle(title);
    reset();
    if (!aliveRef.current) return;
    setPhase('ready');
  }, [templateId, reset]);

  useEffect(() => {
    if (!authHydrated) return;
    aliveRef.current = true;
    queueMicrotask(() => {
      void loadTemplate();
    });
    return () => {
      aliveRef.current = false;
      reset();
    };
  }, [loadTemplate, reset, authHydrated]);

  /**
   * `loadTemplate`은 `[templateId, reset]`만 의존해 토큰이 늦게 복원되면 비로그인 응답으로 고정될 수 있음.
   * 티어 템플릿 메타 동기화와 같이 ready 세션에서만 좋아요·myReaction만 재조회한다 (`reset` 호출 없음).
   */
  useEffect(() => {
    if (!authHydrated || !templateId) return;
    if (phase !== 'ready') return;
    if (!sessionRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchWorldCupTemplate(templateId);
        if (!res.ok || cancelled || !aliveRef.current) return;
        const row = (await res.json()) as Record<string, unknown>;
        if (cancelled || !aliveRef.current) return;
        const { likeCount, myReaction } = parseWorldCupTemplateDetailReactionFields(row);
        setTemplateLikeCount(likeCount);
        setTemplateMyReaction(myReaction);
        if (sessionRef.current && aliveRef.current) {
          sessionRef.current = { ...sessionRef.current, likeCount };
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHydrated, accessToken, templateId, phase]);

  useEffect(() => {
    if (phase !== 'ready') return;
    if (!tournamentComplete || !champion) return;
    if (resultsSubmittedRef.current) return;
    resultsSubmittedRef.current = true;
    const state = useWorldCupStore.getState();
    const payload = buildWorldCupStatSubmitPayload(state);
    void submitWorldCupPlayResult({
      templateId,
      winnerItemId: payload.winnerItemId,
      startBracket: payload.startBracket,
      rows: payload.rows,
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
      <WorldCupRankingClient
        templateId={templateId}
        onBackToResult={() => setShowRanking(false)}
        backNavLabel="결과로 돌아가기"
      />
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
        templateTitle={templateTitle || sessionRef.current?.title || '이상형 월드컵'}
        initialTemplateLikeCount={templateLikeCount}
        initialMyReaction={templateMyReaction}
        onLikeCountChange={(next) => {
          setTemplateLikeCount(next);
          if (sessionRef.current) {
            sessionRef.current = { ...sessionRef.current, likeCount: next };
          }
        }}
        onMyReactionResolved={setTemplateMyReaction}
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
