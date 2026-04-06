import Link from 'next/link';

export default async function BoardPostPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);
  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-[var(--bg-base)] px-4 py-12 text-[var(--text-primary)]">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm text-[var(--text-secondary)]">게시글 상세</p>
        <p className="mt-2 text-lg font-semibold">DB 연동 전입니다.</p>
        <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">id: {id}</p>
        <Link
          href="/board"
          className="mt-8 inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-medium hover:bg-[var(--bg-surface)]"
        >
          목록으로
        </Link>
      </div>
    </main>
  );
}
