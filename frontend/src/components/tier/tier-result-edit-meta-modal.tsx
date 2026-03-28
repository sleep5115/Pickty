'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { patchTierResultMeta, type TierResultResponse } from '@/lib/tier-api';

type Props = {
  open: boolean;
  onClose: () => void;
  resultId: string;
  accessToken: string;
  initialTitle: string;
  initialDescription: string;
  /** PATCH 응답 전달 — 목록 갱신에 활용 가능 */
  onSaved: (updated: TierResultResponse) => void;
};

export function TierResultEditMetaModal({
  open,
  onClose,
  resultId,
  accessToken,
  initialTitle,
  initialDescription,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle);
    setDescription(initialDescription);
    setErr(null);
  }, [open, initialTitle, initialDescription]);

  if (!open) return null;

  const handleSave = () => {
    setBusy(true);
    setErr(null);
    void (async () => {
      try {
        const updated = await patchTierResultMeta(
          resultId,
          {
            title: title.trim() || null,
            description: description.trim() || null,
          },
          accessToken,
        );
        onSaved(updated);
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : '저장에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-result-edit-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
          <h2 id="tier-result-edit-title" className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            티어표 정보 수정
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">제목</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">설명</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={10000}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 resize-y min-h-[96px]"
            />
          </label>
          {err && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {err}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy}
            className="text-sm px-4 py-2 rounded-lg font-medium bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
          >
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
