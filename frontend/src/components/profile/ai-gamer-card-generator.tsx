'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { aiGenerateCards, AiQuotaError, type GamerProfileCard } from '@/lib/api/gamer-profile-api';

/**
 * "💡 AI로 3초 만에 카드 생성" 바.
 * 자연어 한 줄 → /ai-generate 호출 → 파싱된 카드를 부모 편집 상태에 병합한다.
 * 429(한도/쿼터)면 토스트로 안내하고 수동 입력을 유지한다(폴백).
 */
export function AiGamerCardGenerator({ onCardsParsed }: { onCardsParsed: (cards: GamerProfileCard[]) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const onGenerate = async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      toast.error('게임 이력을 한 줄로 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const cards = await aiGenerateCards(trimmed);
      if (cards.length === 0) {
        toast.error('문장에서 게임을 찾지 못했어요. 좀 더 구체적으로 적어 주세요.');
        return;
      }
      onCardsParsed(cards);
      toast.success(`AI가 게임 ${cards.length}개를 추가했어요.`);
      setText('');
      setOpen(false);
    } catch (e) {
      if (e instanceof AiQuotaError) {
        toast.info(e.message);
      } else {
        toast.error(e instanceof Error ? e.message : 'AI 생성에 실패했습니다.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/60 dark:bg-violet-950/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-bold text-violet-700 dark:text-violet-200"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        AI로 3초 만에 카드 생성하기
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="예: 할나 S등급 깨고 롤 다이아 찍음, 스타듀밸리 2500시간 함"
            className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-400"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void onGenerate()}
              disabled={busy}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {busy ? '분석 중…' : '카드 생성'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
