'use client';

import { startTransition, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, X } from 'lucide-react';
import { getProfileHistory, removeProfileHistory } from '@/lib/gamer-profile-history';

export default function GamerProfileLandingPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const list = getProfileHistory();
    startTransition(() => {
      setHistory(list);
    });
  }, []);

  const onSearch = () => {
    const slug = query.trim().toLowerCase();
    if (slug.length === 0) return;
    router.push(`/profile/${encodeURIComponent(slug)}`);
  };

  const onRemoveHistory = (slug: string) => {
    removeProfileHistory(slug);
    setHistory(getProfileHistory());
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-2xl flex-col items-center justify-center gap-8 bg-[var(--bg-base)] px-4 py-12 text-center text-[var(--text-primary)]">
      <div>
        <h1 className="bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
          게임인생프로필
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)] sm:text-base">
          PC·콘솔·인디·고전을 아우르는 나만의 게이머 명함.
          <br />
          닉네임만으로 3초 만에 만들고 디스코드·커뮤니티에 공유하세요.
        </p>
      </div>

      <Link
        href="/profile/create"
        className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-3.5 text-base font-bold text-white shadow-sm shadow-violet-600/25 transition hover:bg-violet-500"
      >
        <Sparkles className="h-5 w-5" aria-hidden />내 프로필 만들기
      </Link>

      <div className="w-full">
        <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">프로필 주소로 찾아보기</p>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch();
            }}
            placeholder="프로필 주소 ID 입력 (예: my-nickname)"
            className="min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm outline-none focus:border-violet-400"
          />
          <button
            type="button"
            onClick={onSearch}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] transition hover:border-violet-400 hover:text-violet-600"
            aria-label="검색"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>

        {/* 이 브라우저의 최근 프로필 바로가기 */}
        {history.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-left text-xs font-medium text-[var(--text-secondary)]">최근 본 프로필</p>
            <div className="flex flex-wrap gap-2">
              {history.map((slug) => (
                <span
                  key={slug}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-1 pl-3 pr-1.5 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/profile/${encodeURIComponent(slug)}`)}
                    className="font-medium text-violet-600 transition hover:underline dark:text-violet-300"
                  >
                    {slug}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveHistory(slug)}
                    aria-label={`${slug} 기록 삭제`}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-base)] hover:text-rose-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
