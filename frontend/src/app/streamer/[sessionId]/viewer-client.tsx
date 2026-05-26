'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStreamerViewerStore, matchKeyOf } from '@/lib/store/streamer-viewer-store';
import { useStreamerStatusPolling } from '@/lib/hooks/use-streamer-status-polling';
import { ensureVisitorId } from '@/lib/streamer/visitor-id';
import { castWorldcupVote, type StreamerStatus } from '@/lib/streamer/streamer-api';
import { fetchWorldCupTemplate } from '@/lib/worldcup/worldcup-template-api';
import { parseWorldCupItemsPayload } from '@/lib/worldcup/worldcup-template-items';
import type { WorldCupItem } from '@/lib/store/worldcup-store';

interface ViewerClientProps {
  sessionId: string;
}

export function ViewerClient({ sessionId }: ViewerClientProps) {
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
          matchKey={currentMatchInfo.matchKey}
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
  matchKey: string;
  leftId: string;
  rightId: string;
  label: string | null;
  left: WorldCupItem | undefined;
  right: WorldCupItem | undefined;
  vote: { selectedId: string; votes: Record<string, number>; duplicate: boolean } | null;
  onVote: (selectedId: string) => void;
}

function MatchBallot({ matchKey, leftId, rightId, label, left, right, vote, onVote }: MatchBallotProps) {
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
        <div className="text-center text-xs text-zinc-400">매치 키: {matchKey}</div>
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
        <img src={item.imageUrl} alt={item.name || itemId} className="h-2/3 w-full rounded-xl object-cover" />
      ) : (
        <div className="flex h-2/3 w-full items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
          ?
        </div>
      )}
      <div className="line-clamp-2 text-center text-sm font-medium">{item?.name || `#${itemId}`}</div>
    </button>
  );
}
