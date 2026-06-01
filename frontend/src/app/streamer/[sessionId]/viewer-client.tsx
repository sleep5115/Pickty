'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useStreamerViewerStore, matchKeyOf } from '@/lib/store/streamer-viewer-store';
import { useStreamerStatusPolling } from '@/lib/hooks/use-streamer-status-polling';
import { ensureVisitorId } from '@/lib/streamer/visitor-id';
import {
  castWorldcupVote,
  fetchStreamerStatusOnce,
  submitTier,
  type StreamerStatus,
} from '@/lib/streamer/streamer-api';
import { fetchWorldCupTemplate } from '@/lib/worldcup/worldcup-template-api';
import { parseWorldCupItemsPayload } from '@/lib/worldcup/worldcup-template-items';
import type { WorldCupItem } from '@/lib/store/worldcup-store';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { TierBoard } from '@/components/tier/tier-board';
import { useTierStore, isTierSpacerId } from '@/lib/store/tier-store';
import { getTemplate, templatePayloadToTierItems } from '@/lib/tier-api';
import { parseTemplateBoardConfig } from '@/lib/template-board-config';

interface ViewerClientProps {
  sessionId: string;
}

export function ViewerClient({ sessionId }: ViewerClientProps) {
  const [init, setInit] = useState<StreamerStatus | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetchStreamerStatusOnce(sessionId).then((s) => {
      if (!cancelled) setInit(s);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (init === undefined) {
    return <ViewerNotice text="세션을 확인하는 중이에요…" />;
  }
  if (init === null) {
    return <ViewerNotice text="세션을 찾을 수 없어요. 링크를 다시 확인해 주세요." />;
  }
  if (init.templateType === 'TIER') {
    return <TierViewerClient sessionId={sessionId} initialStatus={init} />;
  }
  return <WorldcupViewerClient sessionId={sessionId} />;
}

function ViewerNotice({ text }: { text: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}

function WorldcupViewerClient({ sessionId }: ViewerClientProps) {
  const [itemsById, setItemsById] = useState<Map<string, WorldCupItem>>(new Map());
  const [templateLoaded, setTemplateLoaded] = useState(false);

  const role = useStreamerViewerStore((s) => s.role);
  const status = useStreamerViewerStore((s) => s.status);
  const votedByMatch = useStreamerViewerStore((s) => s.votedByMatch);
  const setRole = useStreamerViewerStore((s) => s.setRole);
  const setStatus = useStreamerViewerStore((s) => s.setStatus);
  const recordVote = useStreamerViewerStore((s) => s.recordVote);
  const resetForSession = useStreamerViewerStore((s) => s.resetForSession);

  // 세션 ID가 바뀌면 store 리셋. visitorId 발급은 polling/vote 시점에 ensureVisitorId() 직접 호출.
  useEffect(() => {
    resetForSession();
  }, [sessionId, resetForSession]);

  // 템플릿 메타를 한 번만 받아서 ID → 이름/이미지 룩업 테이블 구성
  useEffect(() => {
    if (!status?.templateId || status.templateType !== 'WORLDCUP' || templateLoaded) return;
    let abort = false;
    (async () => {
      try {
        const res = await fetchWorldCupTemplate(status.templateId);
        if (!res.ok) return;
        const json = (await res.json()) as { items: unknown };
        if (abort) return;
        const items = parseWorldCupItemsPayload(json.items as Record<string, unknown> | unknown[] | null);
        const map = new Map<string, WorldCupItem>();
        for (const it of items) map.set(String(it.id), it);
        setItemsById(map);
        setTemplateLoaded(true);
      } catch {
        /* 비치명적 — 이름 대신 ID 표시 */
      }
    })();
    return () => {
      abort = true;
    };
  }, [status?.templateId, status?.templateType, templateLoaded]);

  useStreamerStatusPolling({
    sessionId,
    enabled: !!role,
    onStatus: (snap: StreamerStatus) => setStatus(snap),
  });

  const currentMatchInfo = useMemo(() => {
    if (!status?.currentMatch) return null;
    const { leftId, rightId, label } = status.currentMatch;
    return {
      leftId,
      rightId,
      label,
      matchKey: matchKeyOf(leftId, rightId),
      left: itemsById.get(leftId),
      right: itemsById.get(rightId),
    };
  }, [status?.currentMatch, itemsById]);

  async function handleVote(selectedId: string) {
    if (!currentMatchInfo) return;
    const visitorId = ensureVisitorId();
    if (!visitorId) return;
    try {
      const result = await castWorldcupVote(sessionId, {
        leftId: currentMatchInfo.leftId,
        rightId: currentMatchInfo.rightId,
        selectedId,
        visitorId,
      });
      recordVote({
        matchKey: currentMatchInfo.matchKey,
        selectedId,
        duplicate: result.duplicate,
        votes: result.votes,
      });
    } catch (err) {
      console.warn('vote failed', err);
    }
  }

  if (!role) {
    return <EntrySelector onPick={setRole} />;
  }

  if (role === 'personal_play') {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h2 className="text-lg font-semibold">나만의 플레이는 준비 중이에요</h2>
        <p className="text-sm text-zinc-500">
          이 모드는 Phase 2에서 제공됩니다. 그때까지는 &lsquo;방장과 함께 투표하기&rsquo;로 참여해 주세요!
        </p>
        <button
          type="button"
          onClick={() => setRole('host_vote')}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          방장과 함께 투표하기로 전환
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between text-sm text-zinc-500">
        <span>방장과 함께 투표</span>
        <span>참여자 약 {status?.activeUserCount ?? 0}명</span>
      </header>

      {status?.status === 'FINISHED' || status?.status === 'EXPIRED_FINISHED' ? (
        <SessionFinished />
      ) : !currentMatchInfo ? (
        <WaitingForMatch />
      ) : (
        <MatchBallot
          leftId={currentMatchInfo.leftId}
          rightId={currentMatchInfo.rightId}
          label={currentMatchInfo.label}
          left={currentMatchInfo.left}
          right={currentMatchInfo.right}
          vote={votedByMatch[currentMatchInfo.matchKey] ?? null}
          onVote={handleVote}
        />
      )}
    </div>
  );
}

function EntrySelector({ onPick }: { onPick: (role: 'host_vote' | 'personal_play') => void }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <h1 className="text-2xl font-bold">어떻게 참여하시겠어요?</h1>
      <p className="text-sm text-zinc-500">
        방송 화면에 맞춰 표만 던지거나, 본인의 결과도 같이 만들 수 있어요.
      </p>
      <div className="grid w-full gap-3">
        <button
          type="button"
          onClick={() => onPick('host_vote')}
          className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:border-zinc-400"
        >
          <div className="text-base font-semibold">방장과 함께 투표하기</div>
          <div className="mt-1 text-xs text-zinc-500">
            방장의 진행에 맞춰 1초 만에 표만 던집니다. 모바일 추천.
          </div>
        </button>
        <button
          type="button"
          onClick={() => onPick('personal_play')}
          className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:border-zinc-400"
        >
          <div className="text-base font-semibold">나만의 플레이 완성하기</div>
          <div className="mt-1 text-xs text-zinc-500">
            (Phase 2 예정) 직접 월드컵/티어표를 끝까지 진행하면 방장 통계에 가중치로 반영됩니다.
          </div>
        </button>
      </div>
    </div>
  );
}

function WaitingForMatch() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
      방장이 첫 대진을 시작할 때까지 잠시 기다려 주세요…
    </div>
  );
}

function SessionFinished() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-600">
      방장이 세션을 종료했어요. 참여해 주셔서 감사합니다!
    </div>
  );
}

interface MatchBallotProps {
  leftId: string;
  rightId: string;
  label: string | null;
  left: WorldCupItem | undefined;
  right: WorldCupItem | undefined;
  vote: { selectedId: string; votes: Record<string, number>; duplicate: boolean } | null;
  onVote: (selectedId: string) => void;
}

function MatchBallot({ leftId, rightId, label, left, right, vote, onVote }: MatchBallotProps) {
  return (
    <section className="flex flex-col gap-3">
      {label ? <div className="text-center text-sm text-zinc-500">{label}</div> : null}
      <div className="grid grid-cols-2 gap-3">
        <Candidate
          itemId={leftId}
          item={left}
          locked={!!vote}
          highlighted={vote?.selectedId === leftId}
          onPick={() => onVote(leftId)}
        />
        <Candidate
          itemId={rightId}
          item={right}
          locked={!!vote}
          highlighted={vote?.selectedId === rightId}
          onPick={() => onVote(rightId)}
        />
      </div>
      {vote ? (
        <div className="text-center text-xs text-zinc-500">
          {vote.duplicate
            ? '이미 이 대결에는 투표하셨어요. 다음 매치를 기다려 주세요.'
            : '투표 완료! 방장이 다음 매치로 넘기면 다시 투표할 수 있어요.'}
        </div>
      ) : (
        <div className="text-center text-xs text-zinc-400">한 쪽을 골라 표를 던져 주세요.</div>
      )}
    </section>
  );
}

function Candidate({
  itemId,
  item,
  locked,
  highlighted,
  onPick,
}: {
  itemId: string;
  item: WorldCupItem | undefined;
  locked: boolean;
  highlighted: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onPick}
      className={[
        'flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-3 transition-shadow',
        highlighted ? 'border-emerald-500 shadow-lg' : 'border-zinc-200',
        locked ? 'opacity-80' : 'hover:border-zinc-400 hover:shadow-md',
      ].join(' ')}
    >
      {item?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={picktyImageDisplaySrc(item.imageUrl)} alt={item.name || itemId} className="h-2/3 w-full rounded-xl object-cover" />
      ) : (
        <div className="flex h-2/3 w-full items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
          ?
        </div>
      )}
      <div className="line-clamp-2 text-center text-sm font-medium">{item?.name || `#${itemId}`}</div>
    </button>
  );
}

/** 티어 세션 시청자 — 방장 보드로 본인 티어표 완성 후 제출(1인 1회). */
function TierViewerClient({
  sessionId,
  initialStatus,
}: {
  sessionId: string;
  initialStatus: StreamerStatus;
}) {
  const loadTemplateWorkspace = useTierStore((s) => s.loadTemplateWorkspace);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'submitted'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ total: number; duplicate: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const detail = await getTemplate(initialStatus.templateId, null);
        if (cancelled) return;
        const pool = templatePayloadToTierItems(detail.items);
        if (pool.length === 0) {
          setPhase('error');
          return;
        }
        loadTemplateWorkspace({
          templateId: initialStatus.templateId,
          pool,
          workspaceTemplateTitle: detail.title,
          workspaceTemplateDescription: null,
          boardConfig: parseTemplateBoardConfig(initialStatus.boardConfig),
        });
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialStatus.templateId, initialStatus.boardConfig, loadTemplateWorkspace]);

  async function handleSubmit() {
    const { tiers, pool } = useTierStore.getState();
    const unplaced = pool.filter((i) => !isTierSpacerId(i.id)).length;
    if (unplaced > 0) {
      toast.error(`아직 배치하지 않은 아이템이 ${unplaced}개 있어요. 모두 배치한 뒤 제출해 주세요.`);
      return;
    }
    const placements = tiers.flatMap((t, idx) =>
      t.items.filter((i) => !isTierSpacerId(i.id)).map((i) => ({ itemId: i.id, rowIndex: idx })),
    );
    if (placements.length === 0) {
      toast.error('배치된 아이템이 없어요.');
      return;
    }
    const visitorId = ensureVisitorId();
    if (!visitorId) return;
    setSubmitting(true);
    try {
      const r = await submitTier(sessionId, { placements, visitorId });
      setResult({ total: r.totalSubmissions, duplicate: r.duplicate });
      setPhase('submitted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '제출에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'loading') return <ViewerNotice text="티어판을 불러오는 중이에요…" />;
  if (phase === 'error') return <ViewerNotice text="티어판을 불러오지 못했어요. 링크를 확인해 주세요." />;
  if (phase === 'submitted') {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-3xl">✅</div>
        <h2 className="text-lg font-semibold">제출 완료!</h2>
        <p className="text-sm text-zinc-500">
          {result?.duplicate
            ? '이미 제출하셨어요. 한 번만 반영됩니다.'
            : '내 티어표가 방장의 시청자 평균에 반영됐어요.'}
        </p>
        <p className="text-xs text-zinc-400">지금까지 {result?.total ?? 0}명 제출</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="shrink-0 border-b border-zinc-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900 dark:border-white/10 dark:bg-violet-950/40 dark:text-violet-100">
        나만의 티어표를 완성해 제출하면 방장의 시청자 평균에 반영돼요.
      </div>
      <TierBoard variant="template-preview" allowLabelImageUpload={false} />
      <div className="sticky bottom-0 z-10 shrink-0 border-t border-zinc-200 bg-white/95 px-3 py-3 backdrop-blur dark:border-white/10 dark:bg-zinc-900/95">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-violet-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? '제출 중…' : '티어표 제출하기'}
        </button>
      </div>
    </div>
  );
}
