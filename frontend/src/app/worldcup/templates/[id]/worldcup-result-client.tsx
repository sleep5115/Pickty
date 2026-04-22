'use client';

import { useCallback, useEffect, useState } from 'react';
import { Crown, Download, RefreshCw, Share2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { CommentSection } from '@/components/interaction/comment-section';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useAuthStore } from '@/lib/store/auth-store';
import {
  captureWorldCupBracketToPng,
  downloadPngDataUrl,
  formatImageCaptureError,
} from '@/lib/worldcup/worldcup-bracket-capture';
import { WorldCupUrlHeroMedia } from '@/components/worldcup/worldcup-url-media';
import { useWorldCupStore, type WorldCupItem } from '@/lib/store/worldcup-store';

const btnPrimary =
  'inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-200 dark:border-white/15 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700';

const btnSecondary =
  'inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-600/35 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 shadow-sm transition hover:bg-emerald-100/90 dark:border-emerald-500/40 dark:bg-emerald-900/40 dark:text-emerald-100 dark:hover:bg-emerald-900/55';

interface Props {
  templateId: string;
  champion: WorldCupItem;
  onRestart: () => void;
  onShowRanking: () => void;
}

export function WorldCupResultClient({
  templateId,
  champion,
  onRestart,
  onShowRanking,
}: Props) {
  const authHydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const matchHistory = useWorldCupStore((s) => s.matchHistory);
  const [meId, setMeId] = useState<number | null>(null);

  useEffect(() => {
    if (!authHydrated || !accessToken) {
      queueMicrotask(() => setMeId(null));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok || cancelled) return;
        const u = (await res.json()) as { id?: unknown };
        const mid = typeof u.id === 'number' ? u.id : Number(u.id);
        if (Number.isFinite(mid)) setMeId(mid);
      } catch {
        if (!cancelled) setMeId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHydrated, accessToken]);

  const copyShareLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('주소를 클립보드에 복사했어요.');
    } catch {
      toast.error('복사에 실패했어요. 주소 표시줄에서 직접 복사해 주세요.');
    }
  }, []);

  const downloadBracketImage = useCallback(async () => {
    const toastId = 'worldcup-bracket-png';
    try {
      toast.loading('대진표 이미지를 만들고 있어요…', { id: toastId });
      const dataUrl = await captureWorldCupBracketToPng({
        matchHistory,
        championName: champion.name,
      });
      downloadPngDataUrl(dataUrl, `pickty-worldcup-bracket-${templateId.slice(0, 8)}.png`);
      toast.success('이미지를 저장했어요.', { id: toastId });
    } catch (e) {
      toast.error(formatImageCaptureError(e), { id: toastId });
    }
  }, [champion.name, matchHistory, templateId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="border-b border-zinc-200 bg-zinc-50/95 px-4 py-4 dark:border-white/10 dark:bg-zinc-900/80 sm:px-6 md:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-300/60 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-400/30">
            <Trophy className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              이상형 월드컵
            </p>
            <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-white">결과</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 md:py-8 lg:flex-row lg:items-stretch">
        <section className="flex min-h-[min(70vh,640px)] w-full flex-col gap-4 lg:w-[60%]">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 dark:bg-black dark:ring-white/10">
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-amber-300/60 bg-white/90 px-3 py-1.5 text-sm text-amber-950 shadow-lg backdrop-blur-md dark:border-amber-400/30 dark:bg-black/55 dark:text-amber-100">
              <Crown className="size-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
              <span className="font-medium">최종 우승: {champion.name}</span>
            </div>
            {champion.imageUrl?.trim() ? (
              <WorldCupUrlHeroMedia url={champion.imageUrl} name={champion.name} />
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center text-zinc-500 dark:text-zinc-500">
                이미지 없음
              </div>
            )}
          </div>
        </section>

        <aside className="flex w-full flex-col gap-6 lg:w-[40%]">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" className={btnPrimary} onClick={onRestart}>
              <RefreshCw className="size-4 shrink-0 opacity-90" aria-hidden />
              다시 시작
            </button>
            <button type="button" className={btnSecondary} onClick={onShowRanking}>
              <Trophy className="size-4 shrink-0 opacity-90" aria-hidden />
              랭킹 보기
            </button>
            <button type="button" className={btnPrimary} onClick={copyShareLink}>
              <Share2 className="size-4 shrink-0 opacity-90" aria-hidden />
              공유하기
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-inner dark:border-white/10 dark:bg-zinc-900/40">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">댓글</h2>
            <div className="min-h-[280px] flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-white/5 dark:bg-zinc-950/50">
              <CommentSection
                targetType="WORLDCUP_TEMPLATE"
                targetId={templateId}
                currentUserId={meId}
                className="max-h-[min(52vh,480px)] overflow-y-auto px-3 py-2"
              />
            </div>
          </div>
        </aside>
      </div>

      <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/90 px-4 py-4 dark:border-white/10 dark:bg-zinc-900/50 sm:px-6 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">대진 선택 이력을 이미지로 저장할 수 있어요.</p>
          <button
            type="button"
            onClick={() => void downloadBracketImage()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-900 shadow-sm transition hover:bg-violet-100 dark:border-violet-500/40 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-950/70"
          >
            <Download className="size-4 shrink-0 opacity-90" aria-hidden />
            대진표 이미지 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
