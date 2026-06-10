'use client';

import { forwardRef } from 'react';
import { Gamepad2 } from 'lucide-react';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import type { GamerProfileCard as GameCardData, GameSource } from '@/lib/api/gamer-profile-api';

const SOURCE_LABEL: Record<GameSource, string> = {
  API: '전적 연동',
  SEARCH: 'DB 검색',
  AI: 'AI 생성',
  DIRECT: '직접 입력',
};

/**
 * 신문 지면 형태의 단일 명함 카드 (캡처 대상 div).
 * 대표 게임(isMain) 블록은 `md:col-span-2 md:row-span-2`로 크게, 나머지는 `col-span-1`로
 * 우측·하단에 꼬깃꼬깃 맞물리게 배치한다. 다크 게이머 테마(유리 효과) 고정.
 *
 * 인증은 카드별 첨부가 아니라 하단 자율 인증 갤러리로 통합됨 — 카드는 `verified`(백엔드 판단)만 꼬리말에 반영.
 */
export const GamerProfileCard = forwardRef<
  HTMLDivElement,
  { slug: string; cards: GameCardData[]; verified: boolean }
>(function GamerProfileCard({ slug, cards, verified }, ref) {
  // 대표 게임을 맨 앞으로 — 격자 좌상단에 크게 자리잡도록.
  const ordered = [...cards].sort((a, b) => Number(b.isMain) - Number(a.isMain));

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-2xl border border-violet-500/30 bg-[#0b0b12] bg-[radial-gradient(120%_120%_at_0%_0%,rgba(139,92,246,0.18),transparent_55%)] text-zinc-100 shadow-xl shadow-black/40"
    >
      {/* 카드 타이틀 */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="text-base font-black tracking-tight">
          <span className="bg-linear-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            {slug}
          </span>
          <span className="text-zinc-300">의 게임인생프로필</span>
        </span>
      </div>

      {/* 신문 격자 */}
      {ordered.length > 0 ? (
        <div className="grid grid-flow-row-dense grid-cols-1 gap-3 p-4 md:grid-cols-3">
          {ordered.map((card, i) => (
            <GameBlock key={card.id ?? i} card={card} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-zinc-400">아직 등록된 게임 카드가 없습니다.</p>
      )}

      {/* 카드 꼬리말 */}
      <div className="border-t border-white/10 px-4 py-2.5 text-center text-xs">
        {verified ? (
          <span className="text-violet-300">[인증내역 있음] pickty.app/profile/{slug}</span>
        ) : (
          <span className="text-zinc-500">인증내역 없음</span>
        )}
      </div>
    </div>
  );
});

/** 격자 내부의 게임 1칸. 대표 게임이면 col/row span 을 키워 빽빽한 대형 블록으로. */
function GameBlock({ card }: { card: GameCardData }) {
  const spanClass = card.isMain ? 'md:col-span-2 md:row-span-2' : 'col-span-1';
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm ${spanClass}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/30">
          {card.gameIconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picktyImageDisplaySrc(card.gameIconUrl)} alt="" className="h-full w-full object-cover" />
          ) : (
            <Gamepad2 className="h-5 w-5 text-violet-300" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className={`truncate font-bold ${card.isMain ? 'text-lg' : 'text-sm'}`}>{card.gameTitle}</h3>
            {card.isMain ? (
              <span className="shrink-0 rounded bg-violet-500/30 px-1.5 py-0.5 text-[10px] font-bold text-violet-200">
                대표
              </span>
            ) : null}
          </div>
          <span className="text-[10px] text-zinc-400">{SOURCE_LABEL[card.gameSource]}</span>
        </div>
      </div>

      {card.stats.length > 0 ? (
        <dl className={`grid gap-1 ${card.isMain ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
          {card.stats.map((s, i) => (
            <div
              key={`${s.statKey}-${i}`}
              className="flex items-center justify-between gap-2 rounded bg-black/20 px-2 py-1 text-xs"
            >
              <dt className="shrink-0 text-zinc-400">{s.statKey}</dt>
              <dd className="truncate font-semibold text-zinc-100">{s.statValue}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
