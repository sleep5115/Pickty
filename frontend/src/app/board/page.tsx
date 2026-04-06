'use client';

import Link from 'next/link';
import { PenLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listBoardPosts, type BoardPostSummary } from '@/lib/api/board-api';

function authorLabel(post: BoardPostSummary): string {
  const nick = post.authorNickname?.trim() || '익명';
  const ip = post.authorIpPrefix?.trim();
  return ip ? `${nick} (${ip})` : nick;
}

function dateOnly(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10) || '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BoardPage() {
  const [rows, setRows] = useState<BoardPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const page = await listBoardPosts(0, 30);
        if (!cancelled) setRows(page.content);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '게시글을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] w-full bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="flex w-full flex-col gap-6 px-1 py-8 sm:px-2">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">커뮤니티</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">티어표·템플릿 이야기를 나눠요.</p>
          </div>
          <Link
            href="/board/write"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-fuchsia-500 to-pink-500 px-4 text-sm font-semibold text-white shadow-md shadow-pink-500/25 transition hover:from-fuchsia-400 hover:to-pink-400"
          >
            <PenLine className="size-4" aria-hidden />
            글쓰기
          </Link>
        </header>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="hidden grid-cols-[1fr_180px_110px_90px] items-center border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400 md:grid">
            <span>제목</span>
            <span>작성자</span>
            <span>작성일</span>
            <span className="text-right">조회</span>
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
            {loading ? (
              <li className="px-3 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">불러오는 중…</li>
            ) : error ? (
              <li className="px-3 py-8 text-center text-sm text-rose-500">{error}</li>
            ) : rows.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-slate-500 dark:text-zinc-400">아직 게시글이 없습니다.</li>
            ) : (
              rows.map((post) => (
              <li key={post.id}>
                <article>
                  <Link
                    href={`/board/${post.id}`}
                    className="grid items-center gap-2 px-3 py-2.5 text-sm transition hover:bg-fuchsia-50/60 dark:hover:bg-fuchsia-950/20 md:grid-cols-[1fr_180px_110px_90px]"
                  >
                    <div className="relative min-w-0">
                      <div className="group/preview inline-flex max-w-full items-center gap-1.5 align-middle">
                        <span className="truncate font-medium text-slate-800 group-hover/preview:text-fuchsia-600 dark:text-zinc-100 dark:group-hover/preview:text-fuchsia-400">{post.title}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-zinc-500 md:hidden">
                        {authorLabel(post)} · {dateOnly(post.createdAt)} · 조회 {post.viewCount.toLocaleString()}
                      </div>
                    </div>

                    <span className="hidden truncate text-slate-600 dark:text-zinc-300 md:block">{authorLabel(post)}</span>
                    <time className="hidden text-slate-500 dark:text-zinc-400 md:block" dateTime={post.createdAt}>
                      {dateOnly(post.createdAt)}
                    </time>
                    <span className="hidden text-right font-mono text-slate-600 dark:text-zinc-300 md:block">
                      {post.viewCount.toLocaleString()}
                    </span>
                  </Link>
                </article>
              </li>
            ))
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
