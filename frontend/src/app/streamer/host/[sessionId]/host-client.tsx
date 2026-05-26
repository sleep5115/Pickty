'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Radio } from 'lucide-react';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useAuthStore } from '@/lib/store/auth-store';
import { useStreamerHostSse } from '@/lib/hooks/use-streamer-host-sse';
import { useStreamerHostMatchSync } from '@/lib/hooks/use-streamer-host-match-sync';
import { useStreamerHostAutoFinish } from '@/lib/hooks/use-streamer-host-auto-finish';
import { useStreamerHostStore } from '@/lib/store/streamer-host-store';
import { clearHostToken, loadHostToken, saveHostToken } from '@/lib/streamer/host-token-storage';
import { fetchFallbackHostToken, fetchStreamerStatusOnce } from '@/lib/streamer/streamer-api';
import { WorldCupSessionClient } from '@/app/worldcup/templates/[id]/worldcup-session-client';

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
        <WorldCupSessionClient templateId={templateId} />
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
