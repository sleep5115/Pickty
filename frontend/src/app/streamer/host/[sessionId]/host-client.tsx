'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Radio } from 'lucide-react';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useAuthStore } from '@/lib/store/auth-store';
import { useStreamerHostSse } from '@/lib/hooks/use-streamer-host-sse';
import { useStreamerHostMatchSync } from '@/lib/hooks/use-streamer-host-match-sync';
import { useStreamerHostAutoFinish } from '@/lib/hooks/use-streamer-host-auto-finish';
import { useStreamerHostStore } from '@/lib/store/streamer-host-store';
import { clearHostToken, loadHostToken, saveHostToken } from '@/lib/streamer/host-token-storage';
import {
  fetchFallbackHostToken,
  fetchStreamerStatusOnce,
  fetchTierStats,
  finishStreamerSession,
  type StreamerTemplateType,
  type StreamerTierStats,
} from '@/lib/streamer/streamer-api';
import { WorldCupSessionClient } from '@/app/worldcup/templates/[id]/worldcup-session-client';
import { TierBoard } from '@/components/tier/tier-board';
import { useTierStore, isTierSpacerId, type TierItem } from '@/lib/store/tier-store';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';

interface HostClientProps {
  sessionId: string;
}

type RecoveryStatus = 'idle' | 'restoring' | 'fallback' | 'failed' | 'ready';

/**
 * 방장 스트리머 모드 wrapper.
 *
 * 디자인 의도:
 * - 매치 지정 UI를 따로 두지 않고, 기존 월드컵 플레이 흐름(BracketSelect → Play → Result)을 그대로 mount한다.
 * - 인게임 스토어의 현재 매치업이 바뀔 때마다 `useStreamerHostMatchSync`가 백그라운드에서 PUT /match 호출.
 * - 챔피언 확정 시 `useStreamerHostAutoFinish`가 1회 POST /finish.
 * - SSE 수신 스냅샷은 `useStreamerHostStore`에 보관되고, `CandidateCard`의 임베드 게이지가 자동 구독.
 */
export function HostClient({ sessionId }: HostClientProps) {
  const router = useRouter();
  const authHydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [hostToken, setHostToken] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateType, setTemplateType] = useState<StreamerTemplateType | null>(null);
  const [recovery, setRecovery] = useState<RecoveryStatus>('idle');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const sseConnected = useStreamerHostStore((s) => s.sseConnected);
  const resetHostStore = useStreamerHostStore((s) => s.reset);
  const setSnapshot = useStreamerHostStore((s) => s.setSnapshot);
  const setSseConnected = useStreamerHostStore((s) => s.setSseConnected);

  // hostToken 복구: localStorage → fallback-token API
  useEffect(() => {
    if (!authHydrated) return;
    let cancelled = false;
    (async () => {
      setRecovery('restoring');
      const cached = loadHostToken(sessionId);
      if (cached) {
        if (cancelled) return;
        setHostToken(cached);
        setRecovery('ready');
        return;
      }
      if (!accessToken) {
        if (cancelled) return;
        setRecovery('failed');
        setRecoveryError('로그인 후 접근해 주세요.');
        return;
      }
      setRecovery('fallback');
      try {
        const recovered = await fetchFallbackHostToken(sessionId);
        if (cancelled) return;
        saveHostToken(sessionId, recovered.hostToken);
        setHostToken(recovered.hostToken);
        setRecovery('ready');
      } catch (err) {
        if (cancelled) return;
        setRecovery('failed');
        setRecoveryError(err instanceof Error ? err.message : '호스트 토큰 복구에 실패했어요.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHydrated, accessToken, sessionId]);

  // status API로 templateId 1회 조회 (WorldCupSessionClient에 전달)
  useEffect(() => {
    if (recovery !== 'ready') return;
    let cancelled = false;
    (async () => {
      const status = await fetchStreamerStatusOnce(sessionId).catch(() => null);
      if (!status || cancelled) return;
      setTemplateId(status.templateId);
      setTemplateType(status.templateType);
    })();
    return () => {
      cancelled = true;
    };
  }, [recovery, sessionId]);

  // 언마운트 시 store 정리
  useEffect(() => {
    return () => {
      resetHostStore();
    };
  }, [sessionId, resetHostStore]);

  // 동기화 hook들 — hostToken 준비 후에만 실제 호출 (내부에서 가드)
  useStreamerHostSse({
    sessionId,
    hostToken,
    onSnapshot: setSnapshot,
    onConnectedChange: setSseConnected,
  });
  useStreamerHostMatchSync({
    sessionId,
    hostToken,
    onError: (err) => {
      if (err instanceof Error && /403/.test(err.message)) {
        clearHostToken(sessionId);
        setHostToken(null);
        setRecovery('failed');
        setRecoveryError('호스트 토큰이 만료됐어요. 페이지를 새로고침해 주세요.');
      }
    },
  });
  useStreamerHostAutoFinish({
    sessionId,
    hostToken,
    onFinished: () => {
      // 결과 페이지가 이미 보이는 상태이므로 추가 라우팅은 하지 않음.
      // 라우트 떠날 때 hostToken은 clearHostToken에서 이미 제거됨.
    },
  });

  if (recovery === 'idle' || recovery === 'restoring' || recovery === 'fallback') {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-8 text-sm text-zinc-500">
        <Loader2 className="size-4 animate-spin" aria-hidden /> 호스트 권한 확인 중…
      </div>
    );
  }
  if (recovery === 'failed') {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-zinc-600">
        <p>{recoveryError ?? '권한 복구에 실패했어요.'}</p>
        <button
          type="button"
          onClick={() => router.push('/worldcup/templates')}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          템플릿 목록으로
        </button>
      </div>
    );
  }
  if (!templateId) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-8 text-sm text-zinc-500">
        <Loader2 className="size-4 animate-spin" aria-hidden /> 세션 정보를 불러오는 중…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <HostStatusBar sessionId={sessionId} sseConnected={sseConnected} />
      <div className="flex min-h-0 flex-1 flex-col">
        {templateType === 'TIER' ? (
          hostToken ? <TierHostClient sessionId={sessionId} hostToken={hostToken} /> : null
        ) : (
          <WorldCupSessionClient templateId={templateId} />
        )}
      </div>
    </div>
  );
}

function HostStatusBar({ sessionId, sseConnected }: { sessionId: string; sseConnected: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-violet-50 px-3 py-1.5 text-xs dark:border-white/10 dark:bg-violet-950/40">
      <div className="flex items-center gap-2 text-violet-900 dark:text-violet-100">
        <Radio className="size-3.5" aria-hidden />
        <span className="font-semibold">스트리머 모드</span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] ${sseConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-600'}`}
        >
          {sseConnected ? '실시간' : '재연결 중'}
        </span>
      </div>
      <button
        type="button"
        onClick={async () => {
          const url = `${window.location.origin}/streamer/${sessionId}`;
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            window.prompt('참여 링크', url);
          }
        }}
        className="rounded-full border border-violet-300 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100"
      >
        {copied ? '복사됨!' : '시청자 참여 링크 복사'}
      </button>
    </div>
  );
}

/**
 * 티어 세션 방장 — 본인 티어표(TierBoard) 편집 + 시청자 평균 티어표 토글 비교.
 * 통계는 5초 폴링. 평균 위치는 행별 분포에서 프론트가 가중평균(Σ(rowIndex×표수)/총표수)으로 계산.
 */
function TierHostClient({ sessionId, hostToken }: { sessionId: string; hostToken: string }) {
  const tiers = useTierStore((s) => s.tiers);
  const pool = useTierStore((s) => s.pool);
  const [stats, setStats] = useState<StreamerTierStats | null>(null);
  const [showAverage, setShowAverage] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const s = await fetchTierStats(sessionId, hostToken);
        if (!cancelled) setStats(s);
      } catch {
        /* 일시 실패는 다음 tick 재시도 */
      }
      if (!cancelled) timer = setTimeout(poll, 5000);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, hostToken]);

  const itemsById = useMemo(() => {
    const m = new Map<string, TierItem>();
    for (const it of [...pool, ...tiers.flatMap((t) => t.items)]) m.set(it.id, it);
    return m;
  }, [pool, tiers]);

  const total = stats?.totalSubmissions ?? 0;

  async function handleFinish() {
    if (finishing) return;
    if (!window.confirm('세션을 종료하면 시청자 참여가 마감되고 통계가 저장됩니다. 종료할까요?')) return;
    setFinishing(true);
    try {
      await finishStreamerSession(sessionId, hostToken);
      clearHostToken(sessionId);
      setFinished(true);
    } catch {
      window.alert('세션 종료에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setFinishing(false);
    }
  }

  if (finished) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-zinc-600 dark:text-zinc-300">
        <div className="text-3xl">📊</div>
        <p className="font-semibold">세션을 종료했어요.</p>
        <p className="text-zinc-500">시청자 통계가 저장됐습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-amber-50 px-3 py-2 text-xs dark:border-white/10 dark:bg-amber-950/30">
        <span className="font-medium text-amber-800 dark:text-amber-200">시청자 제출 {total}명</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAverage((v) => !v)}
            className="rounded-full border border-amber-400 bg-white px-3 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200"
          >
            {showAverage ? '내 티어표 보기' : '시청자 평균 보기'}
          </button>
          <button
            type="button"
            onClick={handleFinish}
            disabled={finishing}
            className="rounded-full border border-rose-300 bg-white px-3 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {finishing ? '종료 중…' : '세션 종료'}
          </button>
        </div>
      </div>
      {showAverage ? (
        stats ? (
          <AverageTierView tiers={tiers} itemsById={itemsById} stats={stats} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-zinc-500">
            통계를 불러오는 중…
          </div>
        )
      ) : (
        <TierBoard variant="template-preview" allowLabelImageUpload={false} />
      )}
    </div>
  );
}

type UnplacedKind = 'tie' | 'none';

function AverageTierView({
  tiers,
  itemsById,
  stats,
}: {
  tiers: Array<{ id: string; label: string; color: string; textColor?: string }>;
  itemsById: Map<string, TierItem>;
  stats: StreamerTierStats;
}) {
  const rowCount = Math.max(1, tiers.length);
  const statByItem = new Map(stats.items.map((s) => [s.itemId, s]));

  /** 분포 → "S 3표, A 1표" 형태 툴팁 */
  const tooltip = (dist: Record<string, number>): string => {
    const parts = Object.entries(dist)
      .filter(([, v]) => v > 0)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([k, v]) => `${tiers[Number(k)]?.label ?? `#${k}`}: ${v}표`);
    return parts.length ? parts.join(', ') : '투표 없음';
  };

  // 최다 득표 행이 1개면 배치, 2개 이상이면 동률(미분류), 0표면 미투표(미분류).
  const rowsItems: Array<Array<{ itemId: string; item: TierItem | undefined }>> = tiers.map(() => []);
  const unclassified: Array<{ itemId: string; item: TierItem | undefined; kind: UnplacedKind; dist: Record<string, number> }> = [];

  for (const itemId of itemsById.keys()) {
    if (isTierSpacerId(itemId)) continue;
    const item = itemsById.get(itemId);
    const dist = statByItem.get(itemId)?.distribution ?? {};
    const entries = Object.entries(dist).filter(([, v]) => v > 0);
    if (entries.length === 0) {
      unclassified.push({ itemId, item, kind: 'none', dist });
      continue;
    }
    const max = Math.max(...entries.map(([, v]) => v));
    const winners = entries.filter(([, v]) => v === max);
    if (winners.length === 1) {
      const row = Math.min(rowCount - 1, Math.max(0, Number(winners[0]![0])));
      rowsItems[row]!.push({ itemId, item });
    } else {
      unclassified.push({ itemId, item, kind: 'tie', dist });
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-2">
      <p className="mb-2 px-1 text-[11px] text-zinc-400">
        시청자 최다 득표 행에 배치 · 1위 동률(⚡)·미투표는 아래 미분류에 모여요. 카드에 마우스를 올리면 분포가 보여요. (제출 {stats.totalSubmissions}명)
      </p>

      <div className="flex flex-col gap-1">
        {tiers.map((tier, idx) => (
          <div key={tier.id} className="flex items-stretch gap-1">
            <div
              className="flex w-14 shrink-0 items-center justify-center rounded-l-md text-center text-sm font-bold"
              style={{ backgroundColor: tier.color, color: tier.textColor ?? '#111827' }}
            >
              {tier.label}
            </div>
            <div className="flex min-h-[3.5rem] flex-1 flex-wrap gap-1 rounded-r-md bg-zinc-100 p-1 dark:bg-zinc-800">
              {rowsItems[idx]!.map(({ itemId, item }) => (
                <AverageCard
                  key={itemId}
                  itemId={itemId}
                  item={item}
                  title={tooltip(statByItem.get(itemId)?.distribution ?? {})}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-1 px-1 text-xs font-semibold text-zinc-500">미분류 {unclassified.length}개</div>
        <div className="flex flex-wrap gap-1 rounded-md border border-dashed border-zinc-300 p-2 dark:border-zinc-700">
          {unclassified.length === 0 ? (
            <span className="px-1 py-2 text-[11px] text-zinc-400">모든 아이템이 배치됐어요.</span>
          ) : (
            unclassified.map(({ itemId, item, kind, dist }) => (
              <AverageCard
                key={itemId}
                itemId={itemId}
                item={item}
                title={kind === 'tie' ? `의견 대립 — ${tooltip(dist)}` : '투표 없음'}
                badge={kind === 'tie' ? '⚡' : undefined}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AverageCard({
  itemId,
  item,
  title,
  badge,
}: {
  itemId: string;
  item: TierItem | undefined;
  title: string;
  badge?: string;
}) {
  return (
    <div className="relative h-14 w-14" title={title}>
      {item?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picktyImageDisplaySrc(item.imageUrl)}
          alt={item.name || itemId}
          className="h-14 w-14 rounded object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded bg-zinc-200 p-0.5 text-center text-[9px] leading-tight text-zinc-500 dark:bg-zinc-700">
          {item?.name || itemId}
        </div>
      )}
      {badge ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1 text-[10px] leading-tight text-white shadow">
          {badge}
        </span>
      ) : null}
    </div>
  );
}
