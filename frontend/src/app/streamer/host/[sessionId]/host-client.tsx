'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useStreamerHostSse } from '@/lib/hooks/use-streamer-host-sse';
import { useStreamerHostStore } from '@/lib/store/streamer-host-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { clearHostToken, loadHostToken, saveHostToken } from '@/lib/streamer/host-token-storage';
import {
  fetchFallbackHostToken,
  fetchStreamerStatusOnce,
  finishStreamerSession,
  updateCurrentMatch,
} from '@/lib/streamer/streamer-api';
import { fetchWorldCupTemplate } from '@/lib/worldcup/worldcup-template-api';
import { parseWorldCupItemsPayload } from '@/lib/worldcup/worldcup-template-items';
import type { WorldCupItem } from '@/lib/store/worldcup-store';

interface HostClientProps {
  sessionId: string;
}

type RecoveryStatus = 'idle' | 'restoring' | 'fallback' | 'failed' | 'ready';

export function HostClient({ sessionId }: HostClientProps) {
  const router = useRouter();
  const authHydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [hostToken, setHostToken] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryStatus>('idle');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const [items, setItems] = useState<WorldCupItem[]>([]);
  const [leftPicked, setLeftPicked] = useState<string | null>(null);
  const [rightPicked, setRightPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const snapshot = useStreamerHostStore((s) => s.snapshot);
  const sseConnected = useStreamerHostStore((s) => s.sseConnected);
  const setSnapshot = useStreamerHostStore((s) => s.setSnapshot);
  const setSseConnected = useStreamerHostStore((s) => s.setSseConnected);
  const resetHostStore = useStreamerHostStore((s) => s.reset);

  // hostToken 복원: 1) localStorage 2) fallback-token API
  useEffect(() => {
    if (!authHydrated) return;
    let cancelled = false;
    (async () => {
      const cached = loadHostToken(sessionId);
      if (cached) {
        setHostToken(cached);
        setRecovery('ready');
        return;
      }
      if (!accessToken) {
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

  // 세션 ID 변경 시 store 리셋
  useEffect(() => {
    return () => {
      resetHostStore();
    };
  }, [sessionId, resetHostStore]);

  useStreamerHostSse({
    sessionId,
    hostToken,
    onSnapshot: setSnapshot,
    onConnectedChange: setSseConnected,
  });

  // 방장은 status API로 templateId를 1회 확보 → 템플릿 detail에서 아이템 풀 로드.
  // SSE 페이로드엔 templateId가 없으므로 별도 호출이 필요하다.
  useEffect(() => {
    if (recovery !== 'ready') return;
    let cancelled = false;
    (async () => {
      const status = await fetchStreamerStatusOnce(sessionId).catch(() => null);
      if (!status || cancelled) return;
      const detail = await fetchWorldCupTemplate(status.templateId).catch(() => null);
      if (!detail || !detail.ok || cancelled) return;
      const json = (await detail.json()) as { items: unknown };
      if (cancelled) return;
      const parsed = parseWorldCupItemsPayload(json.items as Record<string, unknown> | unknown[] | null);
      setItems(parsed);
    })();
    return () => {
      cancelled = true;
    };
  }, [recovery, sessionId]);

  const itemsById = useMemo(() => {
    const m = new Map<string, WorldCupItem>();
    for (const it of items) m.set(String(it.id), it);
    return m;
  }, [items]);

  async function handleApplyMatch() {
    if (!hostToken || !leftPicked || !rightPicked || leftPicked === rightPicked) return;
    setBusy(true);
    try {
      await updateCurrentMatch(sessionId, hostToken, {
        leftId: leftPicked,
        rightId: rightPicked,
        label: null,
      });
    } catch (err) {
      if (err instanceof Error && /403|host/i.test(err.message)) {
        // hostToken이 만료/변경된 경우 클라 캐시를 비우고 다음 진입에서 fallback 동작.
        clearHostToken(sessionId);
        setHostToken(null);
        setRecovery('failed');
        setRecoveryError('호스트 토큰이 만료됐어요. 페이지를 새로고침해 주세요.');
      } else {
        console.warn('apply match failed', err);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleFinish() {
    if (!hostToken) return;
    if (!window.confirm('세션을 종료하시겠어요? 통계가 영구 저장되고 더 이상 투표를 받을 수 없어요.')) return;
    setBusy(true);
    try {
      await finishStreamerSession(sessionId, hostToken);
      clearHostToken(sessionId);
      router.push('/worldcup/templates');
    } catch (err) {
      console.warn('finish failed', err);
    } finally {
      setBusy(false);
    }
  }

  if (recovery === 'idle' || recovery === 'restoring' || recovery === 'fallback') {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500">
        호스트 권한을 확인하는 중…
      </div>
    );
  }
  if (recovery === 'failed') {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-zinc-600">
        <p>{recoveryError ?? '권한 복구에 실패했어요.'}</p>
        <button type="button" onClick={() => router.push('/worldcup/templates')} className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white">
          템플릿 목록으로
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold">스트리머 모드</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${sseConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-600'}`}>
            {sseConnected ? '실시간 연결' : '재연결 중'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ShareLinkButton sessionId={sessionId} />
          <button
            type="button"
            onClick={handleFinish}
            disabled={busy}
            className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            세션 종료
          </button>
        </div>
      </header>

      <CurrentMatchPanel snapshot={snapshot} itemsById={itemsById} />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">다음 매치 지정</h2>
        <p className="mb-3 text-xs text-zinc-500">아이템 두 개를 골라 시청자들에게 송출합니다.</p>
        {items.length === 0 ? (
          <p className="text-xs text-zinc-400">아이템 목록을 불러오는 중…</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((it) => {
              const id = String(it.id);
              const picked = leftPicked === id || rightPicked === id;
              const side = leftPicked === id ? 'L' : rightPicked === id ? 'R' : null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (leftPicked === id) {
                      setLeftPicked(null);
                    } else if (rightPicked === id) {
                      setRightPicked(null);
                    } else if (!leftPicked) {
                      setLeftPicked(id);
                    } else if (!rightPicked) {
                      setRightPicked(id);
                    } else {
                      setLeftPicked(rightPicked);
                      setRightPicked(id);
                    }
                  }}
                  className={`relative aspect-square overflow-hidden rounded-xl border transition ${picked ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-zinc-200 hover:border-zinc-400'}`}
                >
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-zinc-100 text-xs text-zinc-400">?</div>
                  )}
                  {side ? (
                    <span className="absolute left-1 top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {side}
                    </span>
                  ) : null}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-center text-[10px] text-white">
                    {it.name || `#${id}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setLeftPicked(null);
              setRightPicked(null);
            }}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={handleApplyMatch}
            disabled={!leftPicked || !rightPicked || leftPicked === rightPicked || busy}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            이 매치 시작
          </button>
        </div>
      </section>
    </div>
  );
}

function CurrentMatchPanel({
  snapshot,
  itemsById,
}: {
  snapshot: ReturnType<typeof useStreamerHostStore.getState>['snapshot'];
  itemsById: Map<string, WorldCupItem>;
}) {
  const match = snapshot?.currentMatch;
  if (!match) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
        매치를 시작하면 여기에 시청자 투표율이 실시간으로 표시됩니다.
      </section>
    );
  }
  const leftVotes = snapshot?.matchVotes[match.leftId] ?? 0;
  const rightVotes = snapshot?.matchVotes[match.rightId] ?? 0;
  const total = leftVotes + rightVotes;
  const leftPct = total > 0 ? Math.round((leftVotes / total) * 1000) / 10 : 0;
  const rightPct = total > 0 ? Math.round((rightVotes / total) * 1000) / 10 : 0;
  const left = itemsById.get(match.leftId);
  const right = itemsById.get(match.rightId);
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <CandidateCard item={left} fallbackId={match.leftId} highlighted={leftVotes >= rightVotes} />
        <CandidateCard item={right} fallbackId={match.rightId} highlighted={rightVotes > leftVotes} />
      </div>
      <div className="mt-4">
        <VoteGauge leftPct={leftPct} rightPct={rightPct} leftVotes={leftVotes} rightVotes={rightVotes} />
      </div>
    </section>
  );
}

function CandidateCard({
  item,
  fallbackId,
  highlighted,
}: {
  item: WorldCupItem | undefined;
  fallbackId: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-xl border bg-white p-2 transition-shadow ${
        highlighted ? 'border-emerald-500 shadow-lg' : 'border-zinc-200'
      }`}
    >
      {item?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={item.name} className="aspect-square w-full rounded-lg object-cover" />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-100 text-zinc-400">?</div>
      )}
      <div className="line-clamp-1 text-center text-sm font-medium">{item?.name || `#${fallbackId}`}</div>
    </div>
  );
}

function VoteGauge({ leftPct, rightPct, leftVotes, rightVotes }: { leftPct: number; rightPct: number; leftVotes: number; rightVotes: number }) {
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="bg-emerald-500 transition-[width] duration-700 ease-out"
          style={{ width: `${leftPct}%` }}
        />
        <div
          className="bg-sky-500 transition-[width] duration-700 ease-out"
          style={{ width: `${rightPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-zinc-600">
        <span>왼쪽 {leftVotes}표 · {leftPct.toFixed(1)}%</span>
        <span>오른쪽 {rightVotes}표 · {rightPct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function ShareLinkButton({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/streamer/${sessionId}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt('참여 링크 복사', url);
        }
      }}
      className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs"
    >
      {copied ? '복사됨!' : '참여 링크 복사'}
    </button>
  );
}
