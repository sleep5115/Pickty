'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { deleteWorldCupTemplate } from '@/lib/worldcup/worldcup-template-api';

type Props = {
  open: boolean;
  onClose: () => void;
  templateId: string;
  accessToken: string;
  onDeleted: () => void;
};

export function WorldCupDeleteConfirmDialog({
  open,
  onClose,
  templateId,
  accessToken,
  onDeleted,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const handleDelete = () => {
    setBusy(true);
    setErr(null);
    void (async () => {
      try {
        await deleteWorldCupTemplate(templateId, accessToken);
        onDeleted();
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : '삭제에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wc-delete-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <h2 id="wc-delete-title" className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            월드컵 템플릿 삭제
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
        <div className="p-4">
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            이 월드컵 템플릿을 삭제할까요? 목록에서 사라지며 다시 복구할 수 없습니다.
          </p>
          {err && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
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
            onClick={handleDelete}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {busy ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
