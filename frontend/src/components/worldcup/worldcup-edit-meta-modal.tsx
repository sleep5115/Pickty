'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  patchWorldCupTemplateMeta,
  type PatchWorldCupMetaResponse,
} from '@/lib/worldcup/worldcup-template-api';

type Props = {
  open: boolean;
  onClose: () => void;
  templateId: string;
  accessToken: string;
  initialTitle: string;
  initialDescription: string;
  onSaved: (updated: PatchWorldCupMetaResponse) => void;
};

export function WorldCupEditMetaModal({
  open,
  onClose,
  templateId,
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
    const t = title.trim();
    if (!t) {
      setErr('템플릿 제목을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setErr(null);
    void (async () => {
      try {
        const updated = await patchWorldCupTemplateMeta(
          templateId,
          { title: t, description: description.trim() || null },
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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wc-edit-meta-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <h2 id="wc-edit-meta-title" className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            월드컵 템플릿 정보 수정
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-zinc-800"
            aria-label="닫기"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">제목</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">설명</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={10000}
              className="mt-1 min-h-[96px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          {err && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {err}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
