'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  createComment,
  deleteComment,
  getComments,
  type Comment,
  type CommentPage,
  type InteractionTargetType,
} from '@/lib/api/interaction-api';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthStore } from '@/lib/store/auth-store';
import { CommentInput } from '@/components/interaction/comment-input';
import { COMMUNITY_CARD_SECTION_CLASS } from '@/lib/community-ui';
import { guestNicknamePlainSchema } from '@/lib/schemas/guest-nickname';
import { guestPasswordPlainSchema } from '@/lib/schemas/guest-password';

const PAGE_SIZE = 30;

function formatAuthorLabel(c: Comment): string {
  if (c.memberNickname?.trim()) return c.memberNickname.trim();
  const name = c.authorName?.trim() || '익명';
  const ip = c.authorIpPrefix?.trim();
  return ip ? `${name} (${ip})` : name;
}

function buildReplyMap(flat: Comment[]) {
  const replies = new Map<string, Comment[]>();
  for (const c of flat) {
    const pid = c.parentCommentId;
    if (!pid) continue;
    const arr = replies.get(pid) ?? [];
    arr.push(c);
    replies.set(pid, arr);
  }
  for (const arr of replies.values()) {
    arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return replies;
}

type Props = {
  targetType: InteractionTargetType;
  targetId: string | null | undefined;
  currentUserId: number | null;
  className?: string;
  /** false면 상단「댓글」제목 숨김 — 드로어 등 부모 헤더와 중복 방지 */
  showHeading?: boolean;
  onCommentPosted?: () => void;
  /** 상세 API 등에서 내려온 첫 댓글 페이지가 있으면 초기 목록 GET 생략 */
  initialCommentPage?: CommentPage | null;
};

type CommentItemProps = {
  c: Comment;
  depth: number;
  replyMap: Map<string, Comment[]>;
  isLoggedIn: boolean;
  replyingToId: string | null;
  onToggleReply: (commentId: string) => void;
  onOpenDeleteGuest: (c: Comment) => void;
  onMemberDelete: (c: Comment) => void;
  canDeleteMember: (c: Comment) => boolean;
  viewerIsAdmin: boolean;
  /** 답글 전용 — `replyingToId === c.id` 일 때만 마운트 */
  replyBody: string;
  setReplyBody: (v: string) => void;
  replyGuestNick: string;
  onReplyGuestNickChange: (v: string) => void;
  replyGuestPwd: string;
  onReplyGuestPwdChange: (v: string) => void;
  replyGuestNickError: string | null;
  replyGuestPwdError: string | null;
  submittingReply: boolean;
  onSubmitReply: () => void;
  onCancelReply: () => void;
};

function CommentItem({
  c,
  depth,
  replyMap,
  isLoggedIn,
  replyingToId,
  onToggleReply,
  onOpenDeleteGuest,
  onMemberDelete,
  canDeleteMember,
  replyBody,
  setReplyBody,
  replyGuestNick,
  onReplyGuestNickChange,
  replyGuestPwd,
  onReplyGuestPwdChange,
  replyGuestNickError,
  replyGuestPwdError,
  submittingReply,
  onSubmitReply,
  onCancelReply,
  viewerIsAdmin,
}: CommentItemProps) {
  const replies = replyMap.get(c.id) ?? [];
  /** 비회원 댓글: 비밀번호 모달. 관리자는 즉시 삭제(확인)로 동일 버튼 하나만 */
  const showGuestPwdDelete = c.authorUserId == null && !viewerIsAdmin;
  const showQuickDelete =
    (c.authorUserId != null && (canDeleteMember(c) || viewerIsAdmin)) || (c.authorUserId == null && viewerIsAdmin);
  const inlineReplyOpen = depth === 0 && replyingToId === c.id;

  return (
    <li className={depth > 0 ? 'mt-2 border-l-2 border-slate-200 pl-3 dark:border-zinc-700' : 'mt-3'}>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/80">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">{formatAuthorLabel(c)}</span>
          <div className="flex items-center gap-2">
            {showGuestPwdDelete ? (
              <button
                type="button"
                onClick={() => onOpenDeleteGuest(c)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                삭제
              </button>
            ) : null}
            {showQuickDelete ? (
              <button
                type="button"
                onClick={() => void onMemberDelete(c)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                삭제
              </button>
            ) : null}
            {depth === 0 && (
              <button
                type="button"
                onClick={() => onToggleReply(c.id)}
                className="text-xs text-violet-600 hover:underline dark:text-violet-400"
              >
                답글
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-zinc-300">{c.body}</p>
        <p className="mt-1 text-[10px] text-slate-400 tabular-nums dark:text-zinc-600">{c.createdAt}</p>
      </div>
      {inlineReplyOpen ? (
        <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800/60 dark:bg-violet-950/25">
          <p className="mb-2 text-xs font-medium text-violet-800 dark:text-violet-200">이 댓글에 답글 작성</p>
          <CommentInput
            key={`reply-${c.id}`}
            body={replyBody}
            onBodyChange={setReplyBody}
            isLoggedIn={isLoggedIn}
            guestNick={replyGuestNick}
            guestPwd={replyGuestPwd}
            onGuestNickChange={onReplyGuestNickChange}
            onGuestPwdChange={onReplyGuestPwdChange}
            guestNickError={replyGuestNickError}
            guestPwdError={replyGuestPwdError}
            submitting={submittingReply}
            onSubmit={onSubmitReply}
            onCancelReply={onCancelReply}
            submitLabel="답글 등록"
            placeholder="답글 내용을 입력하세요"
          />
        </div>
      ) : null}
      {replies.length > 0 && (
        <ul className="mt-1 space-y-0">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              c={r}
              depth={depth + 1}
              replyMap={replyMap}
              isLoggedIn={isLoggedIn}
              replyingToId={replyingToId}
              onToggleReply={onToggleReply}
              onOpenDeleteGuest={onOpenDeleteGuest}
              onMemberDelete={onMemberDelete}
              canDeleteMember={canDeleteMember}
              viewerIsAdmin={viewerIsAdmin}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              replyGuestNick={replyGuestNick}
              onReplyGuestNickChange={onReplyGuestNickChange}
              replyGuestPwd={replyGuestPwd}
              onReplyGuestPwdChange={onReplyGuestPwdChange}
              replyGuestNickError={replyGuestNickError}
              replyGuestPwdError={replyGuestPwdError}
              submittingReply={submittingReply}
              onSubmitReply={onSubmitReply}
              onCancelReply={onCancelReply}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommentSection({
  targetType,
  targetId,
  currentUserId,
  className = '',
  showHeading = true,
  onCommentPosted,
  initialCommentPage = null,
}: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isLoggedIn = Boolean(accessToken);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setViewerIsAdmin(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok || cancelled) return;
        const u = (await res.json()) as { role?: unknown };
        setViewerIsAdmin(u.role === 'ADMIN');
      } catch {
        if (!cancelled) setViewerIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const [flat, setFlat] = useState<Comment[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  /** 최상단 — 루트 댓글 전용 */
  const [mainBody, setMainBody] = useState('');
  const [mainGuestNick, setMainGuestNick] = useState('');
  const [mainGuestNickError, setMainGuestNickError] = useState<string | null>(null);
  const [mainGuestPwd, setMainGuestPwd] = useState('');
  const [mainGuestPwdError, setMainGuestPwdError] = useState<string | null>(null);
  const [submittingMain, setSubmittingMain] = useState(false);

  /** 인라인 답글 전용(메인과 완전 분리) */
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyGuestNick, setReplyGuestNick] = useState('');
  const [replyGuestNickError, setReplyGuestNickError] = useState<string | null>(null);
  const [replyGuestPwd, setReplyGuestPwd] = useState('');
  const [replyGuestPwdError, setReplyGuestPwdError] = useState<string | null>(null);
  const [submittingReply, setSubmittingReply] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null);
  const [deletePwd, setDeletePwd] = useState('');
  const [deletePwdError, setDeletePwdError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (pageIndex: number, replace: boolean) => {
      if (!targetId) return;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const data = await getComments(targetType, targetId, pageIndex, PAGE_SIZE);
        setFlat((prev) => (replace ? data.content : [...prev, ...data.content]));
        setPage(data.number);
        setHasMore(!data.last);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '댓글을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [targetType, targetId],
  );

  useEffect(() => {
    if (!targetId) {
      setFlat([]);
      setHasMore(false);
      return;
    }
    if (initialCommentPage != null) {
      setFlat(initialCommentPage.content);
      setPage(initialCommentPage.number);
      setHasMore(!initialCommentPage.last);
      setLoading(false);
      return;
    }
    setPage(0);
    setHasMore(true);
    void loadPage(0, true);
  }, [targetType, targetId, initialCommentPage, loadPage]);

  const roots = useMemo(() => {
    const r = flat.filter((c) => !c.parentCommentId);
    r.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return r;
  }, [flat]);

  const replyMap = useMemo(() => buildReplyMap(flat), [flat]);

  const cancelReply = useCallback(() => {
    setReplyingToId(null);
    setReplyBody('');
    setReplyGuestNick('');
    setReplyGuestPwd('');
    setReplyGuestNickError(null);
    setReplyGuestPwdError(null);
  }, []);

  const onReplyGuestPwdChange = useCallback((v: string) => {
    setReplyGuestPwd(v);
    setReplyGuestPwdError(null);
  }, []);

  const onReplyGuestNickChange = useCallback((v: string) => {
    setReplyGuestNick(v);
    setReplyGuestNickError(null);
  }, []);

  const onMainGuestNickChange = useCallback((v: string) => {
    setMainGuestNick(v);
    setMainGuestNickError(null);
  }, []);

  const submitMain = useCallback(async () => {
    if (!targetId || submittingMain) return;
    let guestPasswordParam: string | undefined;
    let authorNameParam: string | undefined;
    if (!isLoggedIn) {
      const nickRes = guestNicknamePlainSchema.safeParse(mainGuestNick);
      if (!nickRes.success) {
        setMainGuestNickError(nickRes.error.issues[0]?.message ?? null);
      } else {
        setMainGuestNickError(null);
      }
      const pwdRes = guestPasswordPlainSchema.safeParse(mainGuestPwd);
      if (!pwdRes.success) {
        setMainGuestPwdError(pwdRes.error.issues[0]?.message ?? null);
      } else {
        setMainGuestPwdError(null);
      }
      if (!nickRes.success || !pwdRes.success) return;
      guestPasswordParam = pwdRes.data;
      authorNameParam = nickRes.data;
    } else {
      setMainGuestNickError(null);
      setMainGuestPwdError(null);
    }
    const text = mainBody.trim();
    if (!text) {
      toast.error('댓글 내용을 입력해 주세요.');
      return;
    }
    setSubmittingMain(true);
    try {
      await createComment(targetType, targetId, text, {
        parentCommentId: null,
        guestPassword: guestPasswordParam,
        authorName: isLoggedIn ? undefined : authorNameParam,
      });
      setMainBody('');
      setMainGuestPwd('');
      setMainGuestNick('');
      setMainGuestNickError(null);
      toast.success('댓글을 등록했어요.');
      onCommentPosted?.();
      await loadPage(0, true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '등록에 실패했습니다.');
    } finally {
      setSubmittingMain(false);
    }
  }, [
    targetId,
    mainBody,
    submittingMain,
    isLoggedIn,
    mainGuestPwd,
    mainGuestNick,
    targetType,
    loadPage,
    onCommentPosted,
  ]);

  const submitReply = useCallback(async () => {
    const parentId = replyingToId;
    if (!targetId || !parentId || submittingReply) return;
    let guestPasswordParam: string | undefined;
    let authorNameParam: string | undefined;
    if (!isLoggedIn) {
      const nickRes = guestNicknamePlainSchema.safeParse(replyGuestNick);
      if (!nickRes.success) {
        setReplyGuestNickError(nickRes.error.issues[0]?.message ?? null);
      } else {
        setReplyGuestNickError(null);
      }
      const pwdRes = guestPasswordPlainSchema.safeParse(replyGuestPwd);
      if (!pwdRes.success) {
        setReplyGuestPwdError(pwdRes.error.issues[0]?.message ?? null);
      } else {
        setReplyGuestPwdError(null);
      }
      if (!nickRes.success || !pwdRes.success) return;
      guestPasswordParam = pwdRes.data;
      authorNameParam = nickRes.data;
    } else {
      setReplyGuestNickError(null);
      setReplyGuestPwdError(null);
    }
    const text = replyBody.trim();
    if (!text) {
      toast.error('댓글 내용을 입력해 주세요.');
      return;
    }
    setSubmittingReply(true);
    try {
      await createComment(targetType, targetId, text, {
        parentCommentId: parentId,
        guestPassword: guestPasswordParam,
        authorName: isLoggedIn ? undefined : authorNameParam,
      });
      setReplyBody('');
      setReplyGuestPwd('');
      setReplyGuestNick('');
      setReplyGuestNickError(null);
      setReplyingToId(null);
      toast.success('댓글을 등록했어요.');
      onCommentPosted?.();
      await loadPage(0, true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '등록에 실패했습니다.');
    } finally {
      setSubmittingReply(false);
    }
  }, [
    targetId,
    replyingToId,
    replyBody,
    submittingReply,
    isLoggedIn,
    replyGuestPwd,
    replyGuestNick,
    targetType,
    loadPage,
    onCommentPosted,
  ]);

  const onToggleReply = useCallback((commentId: string) => {
    setReplyingToId((prev) => (prev === commentId ? null : commentId));
    setReplyBody('');
    setReplyGuestNick('');
    setReplyGuestPwd('');
    setReplyGuestNickError(null);
    setReplyGuestPwdError(null);
  }, []);

  const openDelete = useCallback((c: Comment) => {
    setDeleteTarget(c);
    setDeletePwd('');
    setDeletePwdError(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const isGuest = deleteTarget.authorUserId == null;
    let deleteGuestPwd: string | undefined;
    if (isGuest && !viewerIsAdmin) {
      const pv = guestPasswordPlainSchema.safeParse(deletePwd);
      if (!pv.success) {
        setDeletePwdError(pv.error.issues[0]?.message ?? null);
        return;
      }
      deleteGuestPwd = pv.data;
    }
    setDeletePwdError(null);
    try {
      await deleteComment(deleteTarget.id, deleteGuestPwd);
      toast.success('댓글을 삭제했어요.');
      setDeleteTarget(null);
      onCommentPosted?.();
      setFlat((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  }, [deleteTarget, deletePwd, onCommentPosted, viewerIsAdmin]);

  const canDeleteMember = useCallback(
    (c: Comment) =>
      isLoggedIn && c.authorUserId != null && currentUserId != null && c.authorUserId === currentUserId,
    [isLoggedIn, currentUserId],
  );

  const handleMemberDelete = useCallback(
    async (c: Comment) => {
      if (!window.confirm('이 댓글을 삭제할까요?')) return;
      try {
        await deleteComment(c.id);
        toast.success('댓글을 삭제했어요.');
        onCommentPosted?.();
        setFlat((prev) => prev.filter((x) => x.id !== c.id));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '삭제에 실패했습니다.');
      }
    },
    [onCommentPosted],
  );

  if (!targetId) return null;

  return (
    <section className={[COMMUNITY_CARD_SECTION_CLASS, className].filter(Boolean).join(' ')}>
      {showHeading ? (
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">댓글</h3>
      ) : null}

      <div className={showHeading ? 'mt-3 space-y-4' : 'space-y-4'}>
        {/* 1. 메인 새 댓글 — 목록 바로 위(최상단), 항상 표시 */}
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600 dark:text-zinc-400">새 댓글</p>
          <CommentInput
            body={mainBody}
            onBodyChange={setMainBody}
            isLoggedIn={isLoggedIn}
            guestNick={mainGuestNick}
            guestPwd={mainGuestPwd}
            onGuestNickChange={onMainGuestNickChange}
            onGuestPwdChange={(v) => {
              setMainGuestPwd(v);
              setMainGuestPwdError(null);
            }}
            guestNickError={mainGuestNickError}
            guestPwdError={mainGuestPwdError}
            submitting={submittingMain}
            onSubmit={submitMain}
            submitLabel="등록"
            placeholder="내용을 입력하세요"
          />
        </div>

        {/* 2. 댓글 목록(무한 스크롤) — 메인 입력 아래 */}
        <div className="border-t border-slate-200 pt-4 dark:border-zinc-800">
          {loading && <p className="text-sm text-slate-500">불러오는 중…</p>}
          {!loading && roots.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-zinc-500">첫 댓글을 남겨 보세요.</p>
          )}
          <ul className="space-y-0">
            {!loading &&
              roots.map((c) => (
                <CommentItem
                  key={c.id}
                  c={c}
                  depth={0}
                  replyMap={replyMap}
                  isLoggedIn={isLoggedIn}
                  replyingToId={replyingToId}
                  onToggleReply={onToggleReply}
                  onOpenDeleteGuest={openDelete}
                  onMemberDelete={handleMemberDelete}
                  canDeleteMember={canDeleteMember}
                  viewerIsAdmin={viewerIsAdmin}
                  replyBody={replyBody}
                  setReplyBody={setReplyBody}
                  replyGuestNick={replyGuestNick}
                  onReplyGuestNickChange={onReplyGuestNickChange}
                  replyGuestPwd={replyGuestPwd}
                  onReplyGuestPwdChange={onReplyGuestPwdChange}
                  replyGuestNickError={replyGuestNickError}
                  replyGuestPwdError={replyGuestPwdError}
                  submittingReply={submittingReply}
                  onSubmitReply={submitReply}
                  onCancelReply={cancelReply}
                />
              ))}
          </ul>
          {hasMore && !loading && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadPage(page + 1, false)}
              className="mt-4 text-sm font-medium text-violet-600 hover:underline disabled:opacity-50 dark:text-violet-400"
            >
              {loadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="guest-delete-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h4 id="guest-delete-title" className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              댓글 삭제
            </h4>
            <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">작성 시 입력한 비밀번호를 입력해 주세요.</p>
            <input
              type="password"
              value={deletePwd}
              onChange={(e) => {
                setDeletePwd(e.target.value);
                setDeletePwdError(null);
              }}
              aria-invalid={deletePwdError ? true : undefined}
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="비밀번호"
              autoFocus
            />
            <p
              className={`mt-1 min-h-[1.125rem] text-xs leading-normal ${deletePwdError ? 'text-red-600 dark:text-red-400' : 'text-transparent'}`}
              aria-live="polite"
            >
              {deletePwdError ?? '\u00a0'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-zinc-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
