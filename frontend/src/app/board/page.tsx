import Link from 'next/link';
import { ImageIcon, PenLine } from 'lucide-react';

type BoardListItem = {
  id: string;
  title: string;
  author: string;
  createdAt: string;
  views: number;
  likes: number;
  thumbnailUrl?: string;
};

const DUMMY_POSTS: BoardListItem[] = [
  {
    id: '1',
    title: '첫 티어표 공유합니다 — 스포 주의',
    author: '픽티유저_01',
    createdAt: '2026-04-05',
    views: 1284,
    likes: 42,
    thumbnailUrl: '/next.svg',
  },
  {
    id: '2',
    title: '템플릿 추천 받아요 (액션 RPG 위주)',
    author: 'tierEnjoyer',
    createdAt: '2026-04-04',
    views: 892,
    likes: 31,
  },
  {
    id: '3',
    title: '이번 시즌 메타 총정리 [장문]',
    author: 'meta_kr',
    createdAt: '2026-04-03',
    views: 2401,
    likes: 156,
    thumbnailUrl: '/next.svg',
  },
  {
    id: '4',
    title: '신규 유저 질문 — 저장은 어디서 보나요?',
    author: 'newbie_slate',
    createdAt: '2026-04-02',
    views: 356,
    likes: 12,
  },
  {
    id: '5',
    title: '커뮤니티 오픈 기념 자유 수다',
    author: 'sleep5115',
    createdAt: '2026-04-01',
    views: 5102,
    likes: 208,
  },
];

export default function BoardPage() {
  return (
    <main className="min-h-[calc(100dvh-3.5rem)] w-full bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="flex w-full flex-col gap-6 px-1 py-8 sm:px-2">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">커뮤니티</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              티어표·템플릿 이야기를 나눠요. (목록은 DB 연동 전 더미 데이터입니다.)
            </p>
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
          <div className="hidden grid-cols-[1fr_130px_110px_90px_90px] items-center border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-400 md:grid">
            <span>제목</span>
            <span>작성자</span>
            <span>작성일</span>
            <span className="text-right">조회</span>
            <span className="text-right">추천</span>
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
            {DUMMY_POSTS.map((post) => (
              <li key={post.id}>
                <article>
                  <Link
                    href={`/board/${post.id}`}
                    className="grid items-center gap-2 px-3 py-2.5 text-sm transition hover:bg-fuchsia-50/60 dark:hover:bg-fuchsia-950/20 md:grid-cols-[1fr_130px_110px_90px_90px]"
                  >
                    <div className="relative min-w-0">
                      <div className="group/preview inline-flex max-w-full items-center gap-1.5 align-middle">
                        <span className="truncate font-medium text-slate-800 group-hover/preview:text-fuchsia-600 dark:text-zinc-100 dark:group-hover/preview:text-fuchsia-400">
                          {post.title}
                        </span>
                        {post.thumbnailUrl ? (
                          <span className="relative inline-flex shrink-0 items-center">
                            <ImageIcon className="size-3.5 text-slate-500 dark:text-zinc-400" aria-label="썸네일 있음" />
                            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-52 -translate-x-1/2 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl group-hover/preview:block dark:border-zinc-700 dark:bg-zinc-900">
                              {/* eslint-disable-next-line @next/next/no-img-element -- 더미 목록 썸네일 미리보기 */}
                              <img src={post.thumbnailUrl} alt="썸네일 미리보기" className="h-32 w-full rounded-md object-cover" />
                            </span>
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-zinc-500 md:hidden">
                        {post.author} · {post.createdAt} · 조회 {post.views.toLocaleString()} · 추천 {post.likes.toLocaleString()}
                      </div>
                    </div>

                    <span className="hidden truncate text-slate-600 dark:text-zinc-300 md:block">{post.author}</span>
                    <time className="hidden text-slate-500 dark:text-zinc-400 md:block" dateTime={post.createdAt}>
                      {post.createdAt}
                    </time>
                    <span className="hidden text-right font-mono text-slate-600 dark:text-zinc-300 md:block">
                      {post.views.toLocaleString()}
                    </span>
                    <span className="hidden text-right font-mono text-slate-600 dark:text-zinc-300 md:block">
                      {post.likes.toLocaleString()}
                    </span>
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
