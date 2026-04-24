'use client';

type Props = {
  body: string;
  onBodyChange: (value: string) => void;
  isLoggedIn: boolean;
  guestNick: string;
  guestPwd: string;
  onGuestNickChange: (value: string) => void;
  onGuestPwdChange: (value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  disabled?: boolean;
  /** 답글 모드일 때 취소 버튼 표시 */
  onCancelReply?: () => void;
  submitLabel?: string;
  placeholder?: string;
  className?: string;
};

export function CommentInput({
  body,
  onBodyChange,
  isLoggedIn,
  guestNick,
  guestPwd,
  onGuestNickChange,
  onGuestPwdChange,
  submitting,
  onSubmit,
  disabled = false,
  onCancelReply,
  submitLabel = '등록',
  placeholder = '내용을 입력하세요',
  className = '',
}: Props) {
  const canSubmit = body.trim().length > 0 && !submitting && !disabled;

  return (
    <div className={['space-y-2', className].filter(Boolean).join(' ')}>
      <textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        rows={3}
        maxLength={10000}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      {!isLoggedIn && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400">닉네임</label>
            <input
              type="text"
              value={guestNick}
              onChange={(e) => onGuestNickChange(e.target.value)}
              maxLength={64}
              placeholder="익명"
              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400">
              비밀번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={guestPwd}
              onChange={(e) => onGuestPwdChange(e.target.value)}
              maxLength={128}
              placeholder="삭제 시 필요"
              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void onSubmit()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {submitting ? '등록 중…' : submitLabel}
        </button>
        {onCancelReply ? (
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            취소
          </button>
        ) : null}
      </div>
    </div>
  );
}
