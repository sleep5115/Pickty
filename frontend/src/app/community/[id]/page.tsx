'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CommentSection } from '@/components/interaction/comment-section';
import { getCommunityPost, type CommunityPostDetail } from '@/lib/api/community-api';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthStore } from '@/lib/store/auth-store';

export default function BoardPostPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [id, setId] = useState<string>('');
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meId, setMeId] = useState<number | null>(null);

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
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok || cancelled) return;
        const u = (await res.json()) as { id?: unknown };
        const mid = typeof u.id === 'number' ? u.id : Number(u.id);
        if (Number.isFinite(mid)) setMeId(mid);
      } catch {
        if (!cancelled) setMeId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const authorLabel =
    post == null
      ? ''
      : post.authorIpPrefix
        ? `${post.authorNickname} (${post.authorIpPrefix})`
        : post.authorNickname;

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-[var(--bg-base)] px-3 py-8 text-[var(--text-primary)] sm:px-4">
      <div className="w-full min-w-0">
        <Link
          href="/community"
          className="inline-flex text-sm font-medium text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)] hover:underline"
        >
          ← 목록으로
        </Link>

        {loading ? (
          <div className="mt-10 py-16 text-center text-sm text-[var(--text-secondary)]">불러오는 중…</div>
        ) : error || !post ? (
          <div className="mt-10 rounded-lg border border-rose-200/80 bg-rose-50/50 px-4 py-8 text-center text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/25 dark:text-rose-300">
            {error ?? '게시글을 찾을 수 없습니다.'}
            <p className="mt-2 text-xs text-rose-600/80 dark:text-rose-400/80">id: {id}</p>
          </div>
        ) : (
          <article className="mt-8">
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

            <section
              className="prose prose-sm mt-10 max-w-none text-[var(--text-primary)] dark:prose-invert prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-primary)] [&_img]:my-5 [&_img]:h-auto [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-lg [&_iframe[src*='youtube']]:aspect-video [&_iframe[src*='youtube']]:h-auto [&_iframe[src*='youtube']]:w-full [&_iframe[src*='youtube']]:max-w-4xl"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />

            <CommentSection
              className="mt-12 border-t border-[var(--border-subtle)] pt-8"
              targetType="COMMUNITY_POST"
              targetId={post.id}
              currentUserId={meId}
              initialCommentPage={post.comments}
            />
          </article>
        )}
      </div>
    </main>
  );
}
