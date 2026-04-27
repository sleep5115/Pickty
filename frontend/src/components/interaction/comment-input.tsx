'use client';

type Props = {
  body: string;
  onBodyChange: (value: string) => void;
  isLoggedIn: boolean;
  guestNick: string;
  guestPwd: string;
  onGuestNickChange: (value: string) => void;
  onGuestPwdChange: (value: string) => void;
  /** 닉네임 필드 아래 인라인 오류 */
  guestNickError?: string | null;
  /** 비밀번호 필드 아래 인라인 오류 */
  guestPwdError?: string | null;
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
  guestNickError = null,
  guestPwdError = null,
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
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
              닉네임<span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              value={guestNick}
              onChange={(e) => onGuestNickChange(e.target.value)}
              maxLength={10}
              placeholder="2~10자"
              aria-invalid={guestNickError ? true : undefined}
              className="h-8 w-[9.5rem] rounded-md border border-slate-200 bg-white px-2 text-[13px] dark:border-zinc-700 dark:bg-zinc-900"
            />
            <p
              className={`min-h-[1.25rem] text-[11px] leading-tight ${guestNickError ? 'text-red-600 dark:text-red-400' : 'text-transparent'}`}
              aria-live="polite"
            >
              {guestNickError ?? '\u00a0'}
            </p>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
              비밀번호<span className="text-red-500">*</span>
            </span>
            <input
              type="password"
              value={guestPwd}
              onChange={(e) => onGuestPwdChange(e.target.value)}
              maxLength={128}
              placeholder="4자 이상"
              aria-invalid={guestPwdError ? true : undefined}
              className="h-8 w-[9.5rem] rounded-md border border-slate-200 bg-white px-2 text-[13px] dark:border-zinc-700 dark:bg-zinc-900"
            />
            <p
              className={`min-h-[1.25rem] text-[11px] leading-tight ${guestPwdError ? 'text-red-600 dark:text-red-400' : 'text-transparent'}`}
              aria-live="polite"
            >
              {guestPwdError ?? '\u00a0'}
            </p>
          </label>
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
