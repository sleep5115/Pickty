'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CommunityPostDeleteDialog } from '@/components/community/community-post-delete-dialog';
import { CommentSection } from '@/components/interaction/comment-section';
import { deleteCommunityPost, getCommunityPost, type CommunityPostDetail } from '@/lib/api/community-api';
import { COMMUNITY_CARD_SECTION_CLASS } from '@/lib/community-ui';
import { communityGuestEditStorageKey } from '@/lib/community-guest-edit-storage';
import { guestPasswordPlainSchema } from '@/lib/schemas/guest-password';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthStore } from '@/lib/store/auth-store';

type DeleteModalMode = 'guest_password' | 'confirm_member' | 'confirm_admin';

export default function BoardPostPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [id, setId] = useState<string>('');
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meId, setMeId] = useState<number | null>(null);
  const [meRole, setMeRole] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalMode, setDeleteModalMode] = useState<DeleteModalMode | null>(null);
  const [guestDeletePwd, setGuestDeletePwd] = useState('');
  const [guestDeletePwdError, setGuestDeletePwdError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [guestEditPwd, setGuestEditPwd] = useState('');
  const [guestEditPwdError, setGuestEditPwdError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(params).then(({ id: pid }) => {
      if (!cancelled) setId(pid);
      void (async () => {
        try {
          const p = await getCommunityPost(pid);
          if (!cancelled) setPost(p);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : '게시글을 불러오지 못했습니다.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!accessToken) {
      setMeId(null);
      setMeRole(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok || cancelled) return;
        const u = (await res.json()) as { id?: unknown; role?: unknown };
        const mid = typeof u.id === 'number' ? u.id : Number(u.id);
        if (Number.isFinite(mid)) setMeId(mid);
        setMeRole(typeof u.role === 'string' ? u.role : null);
      } catch {
        if (!cancelled) {
          setMeId(null);
          setMeRole(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const isAdmin = meRole === 'ADMIN';

  const authorLabel =
    post == null
      ? ''
      : post.authorIpPrefix
        ? `${post.authorNickname} (${post.authorIpPrefix})`
        : post.authorNickname;

  const isGuestPost = post != null && post.authorUserId == null;
  const isMemberOwner =
    post != null && post.authorUserId != null && meId != null && post.authorUserId === meId;

  const showEdit = useMemo(() => {
    if (!post) return false;
    if (isGuestPost) return true;
    return Boolean(accessToken && isMemberOwner);
  }, [post, isGuestPost, accessToken, isMemberOwner]);

  const showDelete = useMemo(() => {
    if (!post) return false;
    if (isAdmin) return true;
    if (isGuestPost) return true;
    return Boolean(accessToken && isMemberOwner);
  }, [post, isAdmin, isGuestPost, accessToken, isMemberOwner]);

  const closeDeleteModal = useCallback(() => {
    if (deleteBusy) return;
    setDeleteModalOpen(false);
    setDeleteModalMode(null);
    setGuestDeletePwd('');
    setGuestDeletePwdError(null);
  }, [deleteBusy]);

  const closeEditModal = useCallback(() => {
    setEditModalOpen(false);
    setGuestEditPwd('');
    setGuestEditPwdError(null);
  }, []);

  const openGuestEditModal = useCallback(() => {
    setGuestEditPwd('');
    setGuestEditPwdError(null);
    setEditModalOpen(true);
  }, []);

  const onGuestEditModalConfirm = useCallback(() => {
    if (!post) return;
    const pv = guestPasswordPlainSchema.safeParse(guestEditPwd);
    if (!pv.success) {
      setGuestEditPwdError(pv.error.issues[0]?.message ?? null);
      return;
    }
    setGuestEditPwdError(null);
    setEditModalOpen(false);
    try {
      sessionStorage.setItem(communityGuestEditStorageKey(post.id), pv.data);
    } catch {
      /* ignore */
    }
    router.push(`/community/${post.id}/edit?guestPwd=${encodeURIComponent(pv.data)}`);
  }, [post, guestEditPwd, router]);

  const runDelete = useCallback(
    async (guestPassword?: string) => {
      if (!post) return;
      setDeleteBusy(true);
      try {
        await deleteCommunityPost(post.id, guestPassword);
        toast.success('게시글을 삭제했습니다.');
        closeDeleteModal();
        router.push('/community');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '삭제에 실패했습니다.');
      } finally {
        setDeleteBusy(false);
      }
    },
    [post, router, closeDeleteModal],
  );

  const onClickDelete = useCallback(() => {
    if (!post) return;
    if (isAdmin) {
      setDeleteModalMode('confirm_admin');
      setDeleteModalOpen(true);
      return;
    }
    if (isGuestPost) {
      setGuestDeletePwd('');
      setGuestDeletePwdError(null);
      setDeleteModalMode('guest_password');
      setDeleteModalOpen(true);
      return;
    }
    setDeleteModalMode('confirm_member');
    setDeleteModalOpen(true);
  }, [post, isAdmin, isGuestPost]);

  const onDeleteModalConfirm = useCallback(async () => {
    if (!post || deleteModalMode == null) return;
    if (deleteModalMode === 'guest_password') {
      const pv = guestPasswordPlainSchema.safeParse(guestDeletePwd);
      if (!pv.success) {
        setGuestDeletePwdError(pv.error.issues[0]?.message ?? null);
        return;
      }
      setGuestDeletePwdError(null);
      await runDelete(pv.data);
      return;
    }
    await runDelete(undefined);
  }, [post, deleteModalMode, guestDeletePwd, runDelete]);

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-[var(--bg-base)] px-3 py-8 text-[var(--text-primary)] sm:px-4">
      <div className="w-full min-w-0">
        {loading ? (
          <div className="py-16 text-center text-sm text-[var(--text-secondary)]">불러오는 중…</div>
        ) : error || !post ? (
          <div className="rounded-lg border border-rose-200/80 bg-rose-50/50 px-4 py-8 text-center text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/25 dark:text-rose-300">
            {error ?? '게시글을 찾을 수 없습니다.'}
            <p className="mt-2 text-xs text-rose-600/80 dark:text-rose-400/80">id: {id}</p>
          </div>
        ) : (
          <article className="mt-2 flex flex-col gap-6 sm:mt-4">
            <section className={COMMUNITY_CARD_SECTION_CLASS}>
              <header>
                <h1 className="text-[1.65rem] font-bold leading-snug tracking-tight text-[var(--text-primary)] sm:text-4xl sm:leading-tight">
                  {post.title}
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--border-subtle)] pb-4 text-sm text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">{authorLabel}</span>
                  <span className="text-[var(--border-subtle)]" aria-hidden>
                    ·
                  </span>
                  <time dateTime={post.createdAt} className="tabular-nums">
                    {post.createdAt}
                  </time>
                  <span className="text-[var(--border-subtle)]" aria-hidden>
                    ·
                  </span>
                  <span className="tabular-nums">조회 {post.viewCount.toLocaleString()}</span>
                </div>
              </header>

              <div
                className="prose prose-sm mt-8 max-w-none text-[var(--text-primary)] dark:prose-invert prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-primary)] [&_img]:my-5 [&_img]:h-auto [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-lg [&_iframe[src*='youtube']]:aspect-video [&_iframe[src*='youtube']]:h-auto [&_iframe[src*='youtube']]:w-full [&_iframe[src*='youtube']]:max-w-4xl"
                dangerouslySetInnerHTML={{ __html: post.contentHtml }}
              />
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              {showEdit ? (
                isGuestPost ? (
                  <button
                    type="button"
                    onClick={openGuestEditModal}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
                  >
                    수정
                  </button>
                ) : (
                  <Link
                    href={`/community/${post.id}/edit`}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
                  >
                    수정
                  </Link>
                )
              ) : null}
              {showDelete ? (
                <button
                  type="button"
                  onClick={() => void onClickDelete()}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-red-300 bg-red-50 px-3 text-sm font-medium text-red-900 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-900/35"
                >
                  삭제
                </button>
              ) : null}
              <Link
                href="/community"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-violet-300 bg-violet-50 px-3 text-sm font-medium text-violet-900 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/35"
              >
                목록
              </Link>
            </div>

            <CommentSection
              targetType="COMMUNITY_POST"
              targetId={post.id}
              currentUserId={meId}
              initialCommentPage={post.comments}
            />

            <CommunityPostDeleteDialog
              open={deleteModalOpen}
              mode={deleteModalMode}
              guestPassword={guestDeletePwd}
              guestPasswordError={guestDeletePwdError}
              onGuestPasswordChange={(v) => {
                setGuestDeletePwd(v);
                setGuestDeletePwdError(null);
              }}
              busy={deleteBusy}
              onClose={closeDeleteModal}
              onConfirm={onDeleteModalConfirm}
            />

            <CommunityPostDeleteDialog
              open={editModalOpen}
              mode="guest_password_edit"
              titleId="community-post-edit-guest-pwd-title"
              guestPassword={guestEditPwd}
              guestPasswordError={guestEditPwdError}
              onGuestPasswordChange={(v) => {
                setGuestEditPwd(v);
                setGuestEditPwdError(null);
              }}
              busy={false}
              onClose={closeEditModal}
              onConfirm={onGuestEditModalConfirm}
            />
          </article>
        )}
      </div>
    </main>
  );
}
