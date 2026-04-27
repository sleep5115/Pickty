'use client';

type DeleteMode = 'guest_password' | 'guest_password_edit' | 'confirm_member' | 'confirm_admin';

type Props = {
  open: boolean;
  mode: DeleteMode | null;
  /** 기본 `community-post-delete-title` — 동시에 두 개 모달을 쓸 때 중복 방지 */
  titleId?: string;
  guestPassword: string;
  guestPasswordError: string | null;
  onGuestPasswordChange: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function CommunityPostDeleteDialog({
  open,
  mode,
  titleId = 'community-post-delete-title',
  guestPassword,
  guestPasswordError,
  onGuestPasswordChange,
  busy,
  onClose,
  onConfirm,
}: Props) {
  if (!open || mode == null) return null;

  const isGuestPassword = mode === 'guest_password' || mode === 'guest_password_edit';
  const isEditGuestRedirect = mode === 'guest_password_edit';
  const title = isEditGuestRedirect ? '게시글 수정' : '게시글 삭제';
  const description =
    mode === 'confirm_admin'
      ? '관리자 권한으로 이 게시글을 즉시 삭제합니다. 계속하시겠습니까?'
      : mode === 'confirm_member'
        ? '정말 이 게시글을 삭제하시겠습니까?'
        : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
          {title}
        </h2>

        {isGuestPassword ? (
          <>
            <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">작성 시 입력한 비밀번호를 입력해 주세요.</p>
            <input
              type="password"
              value={guestPassword}
              onChange={(e) => onGuestPasswordChange(e.target.value)}
              aria-invalid={guestPasswordError ? true : undefined}
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="비밀번호"
              autoFocus
              disabled={busy}
            />
            <p
              className={`mt-1 min-h-[1.125rem] text-xs leading-normal ${guestPasswordError ? 'text-red-600 dark:text-red-400' : 'text-transparent'}`}
              aria-live="polite"
            >
              {guestPasswordError ?? '\u00a0'}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">{description}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-600"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className={
              isEditGuestRedirect
                ? 'rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50'
                : 'rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50'
            }
          >
            {busy ? '처리 중…' : isEditGuestRedirect ? '수정' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
