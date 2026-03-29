'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { deleteTemplate } from '@/lib/tier-api';

type Props = {
  open: boolean;
  onClose: () => void;
  templateId: string;
  accessToken: string;
  onDeleted: () => void;
};

export function TemplateDeleteConfirmDialog({
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
        await deleteTemplate(templateId, accessToken);
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
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="template-delete-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
          <h2 id="template-delete-title" className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            템플릿 삭제
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
        <div className="p-4">
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            이 템플릿을 삭제할까요? 티어표에 사용 중이거나 파생된 템플릿이 있으면 삭제할 수 없습니다.
          </p>
          {err && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
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
            onClick={() => void handleDelete()}
            disabled={busy}
            className="text-sm px-4 py-2 rounded-lg font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
          >
            {busy ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
