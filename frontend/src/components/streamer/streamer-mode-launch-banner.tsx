'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { createStreamerSession } from '@/lib/streamer/streamer-api';
import { saveHostToken } from '@/lib/streamer/host-token-storage';

interface Props {
  templateId: string;
}

/**
 * 월드컵 BracketSelect 상단에 노출되는 스트리머 모드 진입 배너.
 * 클릭 → POST /sessions → localStorage 보관 → /streamer/host/{sessionId} 로 이동.
 */
export function StreamerModeLaunchBanner({ templateId }: Props) {
  const router = useRouter();
  const authHydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = authHydrated && !!accessToken;

  async function handleLaunch() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const created = await createStreamerSession('WORLDCUP', templateId);
      saveHostToken(created.sessionId, created.hostToken);
      router.push(`/streamer/host/${created.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '세션 생성에 실패했어요.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-4 flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-100">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="size-4" aria-hidden />
          <div>
            <div className="font-semibold">스트리머 모드</div>
            <div className="text-xs opacity-80">시청자들이 실시간으로 같이 투표하는 방을 만들어 보세요.</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLaunch}
          disabled={!ready || busy}
          className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
          시작
        </button>
      </div>
      {!ready ? (
        <p className="text-[11px] opacity-70">로그인 후 사용할 수 있어요.</p>
      ) : null}
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}
