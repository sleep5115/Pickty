'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CommentSection } from '@/components/community/comment-section';
import { getBoardPost, type BoardPostDetail } from '@/lib/api/board-api';
import { apiFetch } from '@/lib/api-fetch';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { useAuthStore } from '@/lib/store/auth-store';

export default function BoardPostPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [id, setId] = useState<string>('');
  const [post, setPost] = useState<BoardPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meId, setMeId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(params).then(({ id: pid }) => {
      if (!cancelled) setId(pid);
      void (async () => {
        try {
          const p = await getBoardPost(pid);
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
    <main className="min-h-[calc(100dvh-3.5rem)] bg-[var(--bg-base)] px-4 py-8 text-[var(--text-primary)]">
      <div className="w-full">
        <Link
          href="/board"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--bg-surface)]"
        >
          목록으로
        </Link>

        {loading ? (
          <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center text-sm text-[var(--text-secondary)]">
            불러오는 중…
          </div>
        ) : error || !post ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50/70 p-8 text-center text-sm text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-300">
            {error ?? '게시글을 찾을 수 없습니다.'}
            <p className="mt-2 text-xs opacity-70">id: {id}</p>
          </div>
        ) : (
          <article className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <header>
              <h1 className="text-2xl font-bold">{post.title}</h1>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                <div className="h-12 w-12 overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  {post.authorAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 사용자 프로필 이미지 URL
                    <img src={picktyImageDisplaySrc(post.authorAvatarUrl)} alt={authorLabel} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[var(--text-secondary)]">
                      {post.authorNickname.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{authorLabel}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {post.createdAt} · 조회 {post.viewCount.toLocaleString()}
                  </p>
                </div>
              </div>
            </header>

            <section
              className="prose prose-sm mt-6 max-w-none dark:prose-invert [&_img]:my-4 [&_img]:h-auto [&_img]:w-auto [&_img]:max-w-[800px] [&_img]:rounded-lg [&_img]:border [&_img]:border-[var(--border-subtle)] [&_iframe[src*='youtube']]:aspect-video [&_iframe[src*='youtube']]:h-auto [&_iframe[src*='youtube']]:w-full [&_iframe[src*='youtube']]:max-w-4xl"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />

            <CommentSection
              className="mt-8"
              targetType="BOARD_POST"
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
