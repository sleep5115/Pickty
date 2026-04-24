'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { AiMediaCandidateDto } from '@/lib/ai-generation-api';
import { parseYoutubeVideoId } from '@/lib/worldcup/worldcup-media-url';

export type WorldCupCandidateMediaModalProps = {
  open: boolean;
  onClose: () => void;
  /** 미리보기할 후보(또는 단일 imageUrl만 있을 때 한 요소) */
  candidates: AiMediaCandidateDto[];
  /** 모달 오픈 시 선택할 인덱스 */
  initialIndex: number;
  /** [이 미디어로 채택] 시 현재 커서 인덱스 */
  onAdopt: (chosenIndex: number) => void;
};

function MediaViewer({ url }: { url: string }) {
  const id = parseYoutubeVideoId(url);
  if (id) {
    const src = `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    return (
      <iframe
        key={src}
        title="YouTube 미리보기"
        src={src}
        className="aspect-video w-full max-h-[min(50vh,420px)] rounded-lg border border-slate-200 bg-black dark:border-zinc-700"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="max-h-[min(50vh,420px)] w-auto max-w-full rounded-lg border border-slate-200 object-contain dark:border-zinc-700"
    />
  );
}

export function WorldCupCandidateMediaModal({
  open,
  onClose,
  candidates,
  initialIndex,
  onAdopt,
}: WorldCupCandidateMediaModalProps) {
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (!open || candidates.length === 0) return;
    const clamped = Math.min(Math.max(0, initialIndex), candidates.length - 1);
    setCursor(clamped);
  }, [open, initialIndex, candidates]);

  if (!open || candidates.length === 0) return null;

  const current = candidates[cursor];
  const currentUrl = current?.url ?? '';
  const titleLine = current?.title?.trim();
  const atStart = cursor <= 0;
  const atEnd = cursor >= candidates.length - 1;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wc-candidate-media-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <h2 id="wc-candidate-media-title" className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            미디어 미리보기
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
            aria-label="닫기"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 px-4 py-5">
          <div className="flex w-full items-center justify-center gap-2">
            <button
              type="button"
              disabled={atStart}
              onClick={() => setCursor((c) => Math.max(0, c - 1))}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label="이전 후보"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <div className="flex min-h-[200px] min-w-0 flex-1 items-center justify-center rounded-xl bg-slate-50 p-2 dark:bg-zinc-950/80">
              {currentUrl ? <MediaViewer url={currentUrl} /> : null}
            </div>
            <button
              type="button"
              disabled={atEnd}
              onClick={() => setCursor((c) => Math.min(candidates.length - 1, c + 1))}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label="다음 후보"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
          <p className="text-center text-xs text-slate-500 dark:text-zinc-500">
            {cursor + 1} / {candidates.length}
          </p>
          {titleLine ? (
            <p className="max-w-full px-2 text-center text-sm font-medium leading-snug text-slate-800 dark:text-zinc-200">
              {titleLine}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onAdopt(cursor)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            이 미디어로 채택
          </button>
        </div>
      </div>
    </div>
  );
}
