'use client';

import { useRef, useState } from 'react';
import { Download, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { GamerProfile } from '@/lib/api/gamer-profile-api';
import { downloadProfileCardPng } from '@/lib/gamer-profile-capture';
import { GamerProfileCard } from './gamer-profile-card';
import { GamerRealityFeed } from './gamer-reality-feed';

/** 프로필 읽기 화면 — 단일 명함 카드(캡처 대상) + 그 바깥 하단의 현실 피드. */
export function GamerProfileView({
  profile,
  canEditHint,
  onRequestEdit,
}: {
  profile: GamerProfile;
  canEditHint: boolean;
  onRequestEdit: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const onDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      await downloadProfileCardPng(cardRef.current, profile.slug);
    } catch {
      toast.error('이미지 저장에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-3xl bg-[var(--bg-base)] px-4 py-8 text-[var(--text-primary)]">
      {/* 액션 바 (캡처 영역 바깥) */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-violet-400 hover:text-violet-600 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloading ? '저장 중…' : '이미지 저장'}
        </button>
        {canEditHint ? (
          <button
            type="button"
            onClick={onRequestEdit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            <Pencil className="h-4 w-4" />
            편집/인증 등록
          </button>
        ) : null}
      </div>

      {/* 신문 격자 명함 카드 — 이 div 하나만 캡처 대상 */}
      <GamerProfileCard ref={cardRef} slug={profile.slug} cards={profile.cards} verified={profile.verified} />

      {/* 명함 바깥 하단: 현실 피드(캡처 미포함) */}
      <GamerRealityFeed feeds={profile.feeds} />
    </main>
  );
}
