'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { splitUrlLines } from '@/lib/worldcup/worldcup-media-url';

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (urls: string[]) => void | Promise<void>;
};

export function WorldCupBulkAddModal({ open, onClose, onApply }: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => setText(''));
    }
  }, [open]);

  if (!open) return null;

  const handleApply = () => {
    void (async () => {
      const urls = splitUrlLines(text);
      if (urls.length === 0) return;
      await onApply(urls);
      setText('');
      onClose();
    })();
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wc-bulk-add-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <h2 id="wc-bulk-add-title" className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            일괄 추가
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
        <div className="p-4">
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            이미지·움짤·유튜브 등 미디어 URL을 한 줄에 하나씩 붙여넣으세요. 빈 줄은 무시됩니다.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder={`https://example.com/a.png\nhttps://www.youtube.com/watch?v=xxxxxxxxxxx\nhttps://cdn.example.com/b.gif`}
            className="mt-3 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-500">
            이름은 URL에서 자동 제안되며, 표에서 수정할 수 있습니다.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
