'use client';

import { useState } from 'react';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import type { GamerProfileFeed } from '@/lib/api/gamer-profile-api';
import { ImageLightbox } from './image-lightbox';

type FeedTab = 'REALITY' | 'PROOF';

/**
 * 명함 카드 바깥 하단 갤러리 — "현실 피드" / "인증 갤러리" 탭으로 분리.
 * REALITY 피드는 현실 피드 탭에, PROOF 피드는 인증 갤러리 탭에 매핑한다.
 * 클릭 시 라이트박스로 원본을 본다.
 */
export function GamerRealityFeed({ feeds }: { feeds: GamerProfileFeed[] }) {
  const [tab, setTab] = useState<FeedTab>('REALITY');
  const [active, setActive] = useState<GamerProfileFeed | null>(null);

  const realityFeeds = feeds.filter((f) => f.feedType === 'REALITY');
  const proofFeeds = feeds.filter((f) => f.feedType === 'PROOF');
  const shown = tab === 'REALITY' ? realityFeeds : proofFeeds;
  const emptyMessage =
    tab === 'REALITY' ? '아직 등록된 현실 피드가 없습니다.' : '아직 등록된 인증 자료가 없습니다.';

  return (
    <section className="mt-10">
      {/* 탭 스위처 */}
      <div className="mb-3 inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 text-sm">
        <TabButton active={tab === 'REALITY'} onClick={() => setTab('REALITY')}>
          현실 피드
          <Count n={realityFeeds.length} />
        </TabButton>
        <TabButton active={tab === 'PROOF'} onClick={() => setTab('PROOF')}>
          인증 갤러리
          <Count n={proofFeeds.length} />
        </TabButton>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {shown.map((f, i) => (
            <button
              key={f.id ?? i}
              type="button"
              onClick={() => setActive(f)}
              className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={picktyImageDisplaySrc(f.imageUrl)}
                alt={f.description ?? ''}
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
              {f.description ? (
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-left text-xs text-white">
                  {f.description}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {active ? (
        <ImageLightbox imageUrl={active.imageUrl} caption={active.description} onClose={() => setActive(null)} />
      ) : null}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
        active
          ? 'bg-violet-600 text-white'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-black/10 px-1.5 text-[10px] tabular-nums dark:bg-white/15">{n}</span>
  );
}
