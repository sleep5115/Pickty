'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { listTemplates, type TemplateSummaryResponse } from '@/lib/tier-api';

const DEMO_TEMPLATES = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    title: '포켓몬 티어',
    description: '1세대부터 최신까지, 몬스터들을 한판에',
    itemCount: 48,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    title: '롤 챔피언 티어',
    description: '소환사의 협곡 픽 순위를 정리해 보세요',
    itemCount: 170,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    title: '걸그룹 티어',
    description: '최애 그룹·곡을 나만의 순위로',
    itemCount: 36,
  },
] as const;

function TemplateCard({
  id,
  title,
  description,
  itemLine,
  thumbnailUrl,
  badge,
}: {
  id: string;
  title: string;
  description: string | null;
  itemLine: string;
  thumbnailUrl: string | null;
  badge?: string;
}) {
  return (
    <li>
      <Link
        href={`/tier?templateId=${encodeURIComponent(id)}`}
        className="group flex flex-col rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-md transition-all h-full"
      >
        <div className="aspect-[16/10] bg-linear-to-br from-slate-200 to-slate-100 dark:from-zinc-800 dark:to-zinc-900 relative border-b border-slate-100 dark:border-zinc-800">
          {thumbnailUrl ? (
            <Image
              src={picktyImageDisplaySrc(thumbnailUrl)}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span
                className="text-4xl opacity-40 group-hover:opacity-60 transition-opacity select-none"
                aria-hidden
              >
                ◆
              </span>
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col gap-1 flex-1">
          <span className="font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
            {title}
          </span>
          {description ? (
            <p className="text-sm text-slate-600 dark:text-zinc-400 line-clamp-2">{description}</p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-zinc-500 line-clamp-2">설명 없음</p>
          )}
          <span className="text-xs text-slate-400 dark:text-zinc-600 mt-auto pt-2">
            {itemLine}
            {badge ? ` · ${badge}` : ''}
          </span>
        </div>
      </Link>
    </li>
  );
}

export default function TemplatesPage() {
  const [rows, setRows] = useState<TemplateSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="w-full py-8 px-1 sm:px-2 flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            티어 템플릿
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            템플릿을 고르면 바로 순위를 매길 수 있어요.
          </p>
        </div>
        <Link
          href="/template/new"
          className="inline-flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-base font-semibold px-6 py-3.5 shadow-lg shadow-violet-500/25 dark:shadow-violet-900/30 transition-colors shrink-0"
        >
          새 템플릿 만들기
        </Link>
      </div>

      <section aria-labelledby="templates-real-heading">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h2 id="templates-real-heading" className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
            등록된 템플릿
          </h2>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
          >
            새로고침
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          >
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-zinc-400 py-6">
            아직 등록된 템플릿이 없습니다. 상단의 <strong>새 템플릿 만들기</strong>로 첫 티어표를 만들어 보세요.
          </p>
        )}

        {!loading && !error && rows.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((t) => (
              <TemplateCard
                key={t.id}
                id={t.id}
                title={t.title}
                description={t.description}
                itemLine={`아이템 ${t.itemCount}개`}
                thumbnailUrl={t.thumbnailUrl}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="templates-demo-heading" className="pt-4 border-t border-slate-200 dark:border-zinc-800">
        <h2 id="templates-demo-heading" className="text-sm font-semibold text-slate-600 dark:text-zinc-400 mb-3">
          추천 주제로 시작해 보기
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DEMO_TEMPLATES.map((t) => (
            <TemplateCard
              key={t.id}
              id={t.id}
              title={t.title}
              description={t.description}
              itemLine={`약 ${t.itemCount}개 아이템`}
              thumbnailUrl={null}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
