'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Radio, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { createStreamerSession } from '@/lib/streamer/streamer-api';
import { saveHostToken } from '@/lib/streamer/host-token-storage';
import { useTierStore } from '@/lib/store/tier-store';
import {
  buildTemplateBoardConfigFromEditorState,
  type TemplateBoardConfig,
} from '@/lib/template-board-config';

interface Props {
  templateId: string;
  templateType?: 'WORLDCUP' | 'TIER';
}

/**
 * 월드컵 BracketSelect / 티어표 상세 상단에 노출되는 스트리머 모드 진입 배너.
 * 클릭 → POST /sessions → localStorage 보관 → /streamer/host/{sessionId} 로 이동.
 */
export function StreamerModeLaunchBanner({ templateId, templateType = 'WORLDCUP' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const authHydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 호스트 모드 wrapper(/streamer/host/...)가 WorldCupSessionClient를 다시 mount할 때
  // BracketSelect 위에 또 띄워지는 걸 방지 — 동일 페이지에서 세션을 중복 발급할 위험 차단.
  if (pathname?.startsWith('/streamer/host/')) return null;

  const ready = authHydrated && !!accessToken;

  async function handleLaunch() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      let boardConfig: TemplateBoardConfig | undefined;
      if (templateType === 'TIER') {
        const s = useTierStore.getState();
        boardConfig = buildTemplateBoardConfigFromEditorState(s.tiers, s.workspaceBoardSurface);
      }
      const created = await createStreamerSession(templateType, templateId, boardConfig);
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
            <div className="text-xs opacity-80">
              {templateType === 'TIER'
                ? '시청자들이 만든 티어표의 평균을 모아 내 티어표와 비교해 보세요.'
                : '시청자들이 실시간으로 같이 투표하는 방을 만들어 보세요.'}
            </div>
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
