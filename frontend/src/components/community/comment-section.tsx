'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  createComment,
  deleteComment,
  getComments,
  type CommunityComment,
  type CommunityTargetType,
} from '@/lib/api/community-api';
import { useAuthStore } from '@/lib/store/auth-store';

const PAGE_SIZE = 30;

function formatAuthorLabel(c: CommunityComment): string {
  if (c.memberNickname?.trim()) return c.memberNickname.trim();
  const name = c.authorName?.trim() || '익명';
  const ip = c.authorIpPrefix?.trim();
  return ip ? `${name} (${ip})` : name;
}

function buildReplyMap(flat: CommunityComment[]) {
  const replies = new Map<string, CommunityComment[]>();
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
  targetType: CommunityTargetType;
  targetId: string | null | undefined;
  currentUserId: number | null;
  className?: string;
  onCommentPosted?: () => void;
};

export function CommentSection({
  targetType,
  targetId,
  currentUserId,
  className = '',
  onCommentPosted,
}: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isLoggedIn = Boolean(accessToken);

  const [flat, setFlat] = useState<CommunityComment[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [body, setBody] = useState('');
  const [guestNick, setGuestNick] = useState('');
  const [guestPwd, setGuestPwd] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<CommunityComment | null>(null);
  const [deletePwd, setDeletePwd] = useState('');

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
    setPage(0);
    setHasMore(true);
    void loadPage(0, true);
  }, [targetType, targetId, loadPage]);

  const roots = useMemo(() => {
    const r = flat.filter((c) => !c.parentCommentId);
    r.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return r;
  }, [flat]);

  const replyMap = useMemo(() => buildReplyMap(flat), [flat]);

  const submit = useCallback(async () => {
    const text = body.trim();
    if (!targetId || !text || submitting) return;
    if (!isLoggedIn) {
      const pwd = guestPwd.trim();
      if (!pwd) {
        toast.error('비회원 댓글에는 비밀번호가 필요합니다.');
        return;
      }
    }
    setSubmitting(true);
    try {
      await createComment(targetType, targetId, text, {
        parentCommentId: replyToId,
        guestPassword: isLoggedIn ? undefined : guestPwd.trim(),
        authorName: isLoggedIn ? undefined : guestNick.trim() || undefined,
      });
      setBody('');
      setGuestPwd('');
      setGuestNick('');
      setReplyToId(null);
      toast.success('댓글을 등록했어요.');
      onCommentPosted?.();
      await loadPage(0, true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [
    targetId,
    body,
    submitting,
    isLoggedIn,
    guestPwd,
    guestNick,
    replyToId,
    targetType,
    loadPage,
    onCommentPosted,
  ]);

  const openDelete = useCallback((c: CommunityComment) => {
    setDeleteTarget(c);
    setDeletePwd('');
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const isGuest = deleteTarget.authorUserId == null;
    if (isGuest && !deletePwd.trim()) {
      toast.error('비밀번호를 입력해 주세요.');
      return;
    }
    try {
      await deleteComment(deleteTarget.id, isGuest ? deletePwd.trim() : undefined);
      toast.success('댓글을 삭제했어요.');
      setDeleteTarget(null);
      onCommentPosted?.();
      setFlat((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  }, [deleteTarget, deletePwd, onCommentPosted]);

  const canDeleteMember = useCallback(
    (c: CommunityComment) =>
      isLoggedIn && c.authorUserId != null && currentUserId != null && c.authorUserId === currentUserId,
    [isLoggedIn, currentUserId],
  );

  const handleMemberDelete = useCallback(
    async (c: CommunityComment) => {
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

  const renderComment = (c: CommunityComment, depth: number) => {
    const replies = replyMap.get(c.id) ?? [];
    const showDelGuest = !isLoggedIn && c.authorUserId == null;
    const showDelMember = canDeleteMember(c);
    return (
      <li key={c.id} className={depth > 0 ? 'mt-2 border-l-2 border-slate-200 pl-3 dark:border-zinc-700' : 'mt-3'}>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
              {formatAuthorLabel(c)}
            </span>
            <div className="flex items-center gap-2">
              {showDelGuest && (
                <button
                  type="button"
                  onClick={() => openDelete(c)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  삭제
                </button>
              )}
              {showDelMember && (
                <button
                  type="button"
                  onClick={() => void handleMemberDelete(c)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  삭제
                </button>
              )}
              {depth === 0 && (
                <button
                  type="button"
                  onClick={() => setReplyToId((v) => (v === c.id ? null : c.id))}
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
        {replies.length > 0 && (
          <ul className="mt-1 space-y-0">
            {replies.map((r) => renderComment(r, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  if (!targetId) return null;

  return (
    <section className={['rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50', className].join(' ')}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">댓글</h3>

      <div className="mt-3 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={10000}
          placeholder="내용을 입력하세요"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        {!isLoggedIn && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400">닉네임</label>
              <input
                type="text"
                value={guestNick}
                onChange={(e) => setGuestNick(e.target.value)}
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
                onChange={(e) => setGuestPwd(e.target.value)}
                maxLength={128}
                placeholder="삭제 시 필요"
                className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>
        )}
        {replyToId && (
          <p className="text-xs text-violet-600 dark:text-violet-400">
            답글 작성 중 —{' '}
            <button type="button" className="underline" onClick={() => setReplyToId(null)}>
              취소
            </button>
          </p>
        )}
        <button
          type="button"
          disabled={submitting || !body.trim()}
          onClick={() => void submit()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {submitting ? '등록 중…' : '등록'}
        </button>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4 dark:border-zinc-800">
        {loading && <p className="text-sm text-slate-500">불러오는 중…</p>}
        {!loading && roots.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-zinc-500">첫 댓글을 남겨 보세요.</p>
        )}
        <ul className="space-y-0">{!loading && roots.map((c) => renderComment(c, 0))}</ul>
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
              onChange={(e) => setDeletePwd(e.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="비밀번호"
              autoFocus
            />
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
