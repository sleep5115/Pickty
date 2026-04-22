'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Plus, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

type AiTemplateItemResponse = {
  id: string;
  name: string;
  imageUrl: string;
  focusRect?: { x: number; y: number; w: number; h: number };
};

export type TierTemplateNewAiGeneratedRow = {
  name: string;
  imageUrl: string;
  focusRect?: { x: number; y: number; w: number; h: number };
};

type TierTemplateNewAiPanelProps = {
  accessToken: string;
  excludeItemNames: string[];
  onGenerated: (items: TierTemplateNewAiGeneratedRow[]) => void;
};

/** `/tier/templates/new` — 관리자 전용으로만 부모에서 마운트 */
export function TierTemplateNewAiPanel({
  accessToken,
  excludeItemNames,
  onGenerated,
}: TierTemplateNewAiPanelProps) {
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;

    setAiError(null);
    setIsAiGenerating(true);
    try {
      const resp = await apiFetch('/api/v1/ai/generate-items', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          requireCount: 20,
          excludeItems: excludeItemNames,
        }),
      });

      if (!resp.ok) {
        throw new Error('AI 아이템 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }

      const items: AiTemplateItemResponse[] = await resp.json();
      if (items.length === 0) {
        setAiError('생성된 아이템이 없습니다. 다른 주제로 시도해 보세요.');
        return;
      }

      onGenerated(
        items.map((item) => ({
          name: item.name,
          imageUrl: item.imageUrl,
          focusRect: item.focusRect,
        })),
      );
      setAiPrompt('');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 생성 중 오류가 발생했습니다.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="rounded-xl border border-violet-100 dark:border-violet-900/40 bg-white dark:bg-zinc-950 p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="주제 입력 (예: 블루아카이브 학생들, 포켓몬 1세대...)"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            disabled={isAiGenerating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void handleAiGenerate();
              }
            }}
            className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 pl-3 pr-10 py-2.5 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleAiGenerate()}
          disabled={isAiGenerating || !aiPrompt.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:pointer-events-none text-white text-sm font-semibold px-5 py-2.5 transition-colors whitespace-nowrap"
        >
          {isAiGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              생성 중...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              AI로 아이템 20개 생성
            </>
          )}
        </button>
      </div>

      <p className="text-[0.7rem] text-slate-500 dark:text-zinc-500 leading-relaxed">
        아이템 이름과 이미지를 구글 검색을 통해 자동으로 가져옵니다. <strong>약 10~30초</strong> 정도 소요될 수
        있으며, 생성된 결과는 아래 목록에 추가됩니다.
      </p>

      {aiError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-[0.7rem] text-red-800 dark:text-red-300 border border-red-100 dark:border-red-900/50">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}
    </div>
  );
}
