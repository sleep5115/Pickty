'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { JSONContent } from '@tiptap/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { TiptapEditor } from '@/components/community/TiptapEditor';
import { getCommunityPost, updateCommunityPost, type CommunityPostDetail } from '@/lib/api/community-api';
import { communityGuestEditStorageKey } from '@/lib/community-guest-edit-storage';
import { isCommunityBodyHtmlEffectivelyEmpty } from '@/lib/community-body-html';
import { guestPasswordPlainSchema } from '@/lib/schemas/guest-password';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthStore } from '@/lib/store/auth-store';

export default function CommunityPostEditPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [postId, setPostId] = useState<string>('');
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meId, setMeId] = useState<number | null>(null);
  const [meResolved, setMeResolved] = useState(false);
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  /** 비회원 글: URL `guestPwd`에서 받아 PATCH 시에만 사용 */
  const [guestPwdForPatch, setGuestPwdForPatch] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const guestGateToastRef = useRef(false);

  const isLoggedIn = Boolean(accessToken);
  const isGuestPost = post != null && post.authorUserId == null;

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(params).then(({ id: pid }) => {
      if (!cancelled) setPostId(pid);
      void (async () => {
        try {
          const p = await getCommunityPost(pid);
          if (!cancelled) {
            setPost(p);
            setTitle(p.title);
            setContentHtml(p.contentHtml);
          }
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
      setMeResolved(true);
      return;
    }
    let cancelled = false;
    setMeResolved(false);
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!cancelled) {
          if (res.ok) {
            const u = (await res.json()) as { id?: unknown };
            const mid = typeof u.id === 'number' ? u.id : Number(u.id);
            setMeId(Number.isFinite(mid) ? mid : null);
          } else {
            setMeId(null);
          }
        }
      } catch {
        if (!cancelled) setMeId(null);
      } finally {
        if (!cancelled) setMeResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  /** 회원 글: 본인만 폼 노출. 그 외는 리다이렉트 */
  useEffect(() => {
    if (loading || !post) return;
    if (post.authorUserId == null) return;
    if (!meResolved) return;
    if (!accessToken || meId == null || meId !== post.authorUserId) {
      toast.error('이 게시글을 수정할 권한이 없습니다.');
      router.replace(`/community/${post.id}`);
    }
  }, [loading, post, meResolved, accessToken, meId, router]);

  /** 비회원 글: URL `guestPwd` 또는 모달에서 심은 sessionStorage → state 후 쿼리·스토리지 제거 */
  useEffect(() => {
    if (loading || !post || post.authorUserId != null) return;
    if (guestPwdForPatch !== null) return;

    const fromUrl = searchParams.get('guestPwd');
    let candidate = fromUrl?.trim() ?? '';
    if (!candidate) {
      try {
        candidate = sessionStorage.getItem(communityGuestEditStorageKey(post.id))?.trim() ?? '';
      } catch {
        candidate = '';
      }
    }

    if (candidate !== '') {
      const z = guestPasswordPlainSchema.safeParse(candidate);
      if (!z.success) {
        try {
          sessionStorage.removeItem(communityGuestEditStorageKey(post.id));
        } catch {
          /* ignore */
        }
        if (!guestGateToastRef.current) {
          guestGateToastRef.current = true;
          toast.error('비밀번호가 필요합니다.');
        }
        router.replace(`/community/${post.id}`);
        return;
      }
      setGuestPwdForPatch(z.data);
      try {
        sessionStorage.removeItem(communityGuestEditStorageKey(post.id));
      } catch {
        /* ignore */
      }
      router.replace(`/community/${post.id}/edit`, { scroll: false });
      return;
    }
    if (!guestGateToastRef.current) {
      guestGateToastRef.current = true;
      toast.error('비밀번호가 필요합니다.');
    }
    router.replace(`/community/${post.id}`);
  }, [loading, post, searchParams, router, guestPwdForPatch]);

  const canRenderEditForm = useMemo(() => {
    if (!post) return false;
    if (post.authorUserId == null) return guestPwdForPatch !== null;
    if (!accessToken || !meResolved) return false;
    return meId === post.authorUserId;
  }, [post, accessToken, meResolved, meId, guestPwdForPatch]);

  const showAuthGateLoading = Boolean(
    post && post.authorUserId != null && accessToken && !meResolved,
  );

  const showGuestPwdGateLoading = Boolean(
    !loading && post && post.authorUserId == null && guestPwdForPatch === null,
  );

  const handleEditorChange = useCallback((_json: JSONContent, safeHtml?: string) => {
    setContentHtml(safeHtml ?? '');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!post) return;
    const t = title.trim();
    if (!t) {
      toast.error('제목을 입력해 주세요.');
      return;
    }
    if (isCommunityBodyHtmlEffectivelyEmpty(contentHtml)) {
      toast.error('본문을 입력해 주세요.');
      return;
    }
    if (isGuestPost) {
      if (guestPwdForPatch == null) {
        toast.error('비밀번호가 필요합니다.');
        router.replace(`/community/${post.id}`);
        return;
      }
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await updateCommunityPost(post.id, {
        title: t,
        contentHtml,
        guestPassword: isGuestPost ? guestPwdForPatch : undefined,
      });
      toast.success('수정했습니다.');
      router.push(`/community/${post.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [post, title, contentHtml, isGuestPost, guestPwdForPatch, submitting, router]);

  if (loading || showAuthGateLoading || showGuestPwdGateLoading) {
    return (
      <main className="min-h-[calc(100dvh-3.5rem)] w-full bg-[var(--bg-base)] px-3 py-8 text-[var(--text-primary)] sm:px-4">
        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">불러오는 중…</div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="min-h-[calc(100dvh-3.5rem)] w-full bg-[var(--bg-base)] px-3 py-8 text-[var(--text-primary)] sm:px-4">
        <div className="rounded-lg border border-rose-200/80 bg-rose-50/50 px-4 py-8 text-center text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/25 dark:text-rose-300">
          {error ?? '게시글을 찾을 수 없습니다.'}
          <p className="mt-2 text-xs text-rose-600/80 dark:text-rose-400/80">id: {postId}</p>
        </div>
      </main>
    );
  }

  if (!canRenderEditForm) {
    return (
      <main className="min-h-[calc(100dvh-3.5rem)] w-full bg-[var(--bg-base)] px-3 py-8 text-[var(--text-primary)] sm:px-4">
        <div className="py-16 text-center text-sm text-[var(--text-secondary)]">이동 중…</div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] w-full bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="flex w-full min-w-0 flex-col gap-5 px-3 py-8 sm:px-4">
        <nav className="text-sm text-[var(--text-secondary)]">
          <Link href="/community" className="hover:text-[var(--text-primary)]">
            커뮤니티
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <Link href={`/community/${post.id}`} className="hover:text-[var(--text-primary)]">
            게시글
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-[var(--text-primary)]">수정</span>
        </nav>

        {isGuestPost ? (
          <p className="border-b border-[var(--border-subtle)] pb-2.5 text-xs text-[var(--text-secondary)]">
            비회원 작성 글 · 작성자{' '}
            <span className="font-medium text-[var(--text-primary)]">{post.authorNickname}</span>
            {post.authorIpPrefix ? ` · IP ${post.authorIpPrefix}` : null}
          </p>
        ) : isLoggedIn ? (
          <p className="flex flex-wrap items-baseline gap-x-2 border-b border-[var(--border-subtle)] pb-2.5 text-xs text-[var(--text-secondary)]">
            <span className="shrink-0">작성자(회원)</span>
            <span className="font-medium text-[var(--text-primary)]">{post.authorNickname}</span>
          </p>
        ) : null}

        <div>
          <label htmlFor="community-edit-title" className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            제목
          </label>
          <input
            id="community-edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            maxLength={200}
            className="h-12 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 text-base font-semibold text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-[var(--text-secondary)] placeholder:font-normal focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/25 sm:h-11 sm:text-lg"
          />
        </div>

        <TiptapEditor
          key={post.id}
          accessToken={accessToken}
          initialHtml={post.contentHtml}
          onChange={handleEditorChange}
          placeholder="내용을 작성해 보세요. 이미지는 복붙·드래그로도 넣을 수 있어요."
          className="w-full min-w-0"
        />

        <div className="flex flex-wrap justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push(`/community/${post.id}`)}
            className="h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-base)]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="h-11 rounded-xl bg-linear-to-r from-violet-600 to-fuchsia-600 px-6 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition hover:from-violet-500 hover:to-fuchsia-500"
          >
            {submitting ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </main>
  );
}
