'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Plus, Sparkles } from 'lucide-react';
import {
  type AiMediaCandidateDto,
  type AiMediaTypeWire,
  postAiAutoGenerate,
} from '@/lib/ai-generation-api';

const COUNT_MIN = 1;
const COUNT_MAX = 50;
const COUNT_DEFAULT = 2;

function clampItemCount(raw: number): number {
  if (!Number.isFinite(raw)) return COUNT_DEFAULT;
  return Math.min(COUNT_MAX, Math.max(COUNT_MIN, Math.round(raw)));
}

function parseCountDraft(draft: string): number {
  const n = Number.parseInt(draft.trim(), 10);
  if (!Number.isFinite(n)) return COUNT_DEFAULT;
  return clampItemCount(n);
}

export type AiGenerationGeneratedRow = {
  name: string;
  imageUrl: string;
  candidates: AiMediaCandidateDto[];
  focusRect?: { x: number; y: number; w: number; h: number };
};

export type AiGenerationPanelProps = {
  accessToken: string;
  onGenerated: (items: AiGenerationGeneratedRow[]) => void;
  inputPlaceholder?: string;
  generateButtonLabel?: string;
  hintText?: string;
  /** true면 미디어는 항상 사진(PHOTO)만 사용. 움짤·유튜브 버튼은 비활성화된다. */
  lockMediaTypeToPhoto?: boolean;
};

const MEDIA_OPTIONS: { value: AiMediaTypeWire; label: string }[] = [
  { value: 'PHOTO', label: '사진' },
  { value: 'GIF', label: '움짤' },
  { value: 'YOUTUBE', label: '유튜브' },
];

/**
 * 주제·미디어 타입으로 후보를 자동 채우는 UI.
 * 호출하는 페이지에서 권한 가드(예: ADMIN)를 두는 것을 전제로 한다.
 */
export function AiGenerationPanel({
  accessToken,
  onGenerated,
  inputPlaceholder = '주제 입력',
  generateButtonLabel = 'AI로 후보 생성',
  hintText = 'Gemini로 이름을 만들고, 선택한 미디어 종류에 맞춰 검색 후보 URL을 채웁니다. 개수는 1~50까지 조절할 수 있어요. 약 수 초~1분 가까이 걸릴 수 있습니다.',
  lockMediaTypeToPhoto = false,
}: AiGenerationPanelProps) {
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [itemCountDraft, setItemCountDraft] = useState(String(COUNT_DEFAULT));
  const [mediaType, setMediaType] = useState<AiMediaTypeWire>('PHOTO');
  const [aiError, setAiError] = useState<string | null>(null);

  const effectiveMediaType: AiMediaTypeWire = lockMediaTypeToPhoto ? 'PHOTO' : mediaType;

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;

    const count = parseCountDraft(itemCountDraft);
    setItemCountDraft(String(count));

    setAiError(null);
    setIsAiGenerating(true);
    try {
      const rows = await postAiAutoGenerate(accessToken, {
        prompt: aiPrompt.trim(),
        mediaType: effectiveMediaType,
        count,
      });
      if (rows.length === 0) {
        setAiError('생성된 아이템이 없습니다. 다른 주제로 시도해 보세요.');
        return;
      }
      onGenerated(
        rows.map((row) => ({
          name: row.name,
          candidates: row.candidates,
          imageUrl: row.candidates[0]?.url ?? '',
          focusRect: undefined,
        })),
      );
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 생성 중 오류가 발생했습니다.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="rounded-xl border border-violet-100 dark:border-violet-900/40 bg-white dark:bg-zinc-950 p-4 shadow-sm space-y-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative min-w-0 w-full flex-1 sm:min-w-[12rem]">
            <input
              type="text"
              placeholder={inputPlaceholder}
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
          <div className="flex shrink-0 items-center gap-2">
            <label
              htmlFor="ai-generation-item-count"
              className="text-xs font-medium text-slate-600 dark:text-zinc-400 whitespace-nowrap"
            >
              개수
            </label>
            <input
              id="ai-generation-item-count"
              type="number"
              min={COUNT_MIN}
              max={COUNT_MAX}
              step={1}
              value={itemCountDraft}
              disabled={isAiGenerating}
              onChange={(e) => setItemCountDraft(e.target.value)}
              onBlur={() => setItemCountDraft(String(parseCountDraft(itemCountDraft)))}
              className="w-[4.25rem] shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-center text-sm font-mono text-slate-900 tabular-nums dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500"
              aria-label="생성할 아이템 개수 (1~50)"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAiGenerate()}
            disabled={isAiGenerating || !aiPrompt.trim()}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 hover:bg-violet-500 disabled:opacity-60 disabled:pointer-events-none text-white text-sm font-semibold px-5 transition-colors whitespace-nowrap sm:w-auto"
          >
            {isAiGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {generateButtonLabel}
              </>
            )}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">미디어 종류</span>
          {MEDIA_OPTIONS.map((opt) => {
            const isSelected = effectiveMediaType === opt.value
            const isLockedOut = lockMediaTypeToPhoto && opt.value !== 'PHOTO'
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isAiGenerating || isLockedOut}
                onClick={() => setMediaType(opt.value)}
                className={[
                  'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                  isSelected
                    ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200',
                  isLockedOut ? 'cursor-not-allowed opacity-45 hover:border-slate-200 dark:hover:border-zinc-600' : '',
                ].join(' ')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-[0.7rem] text-slate-500 dark:text-zinc-500 leading-relaxed">{hintText}</p>

      {aiError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-[0.7rem] text-red-800 dark:text-red-300 border border-red-100 dark:border-red-900/50">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{aiError}</span>
        </div>
      )}
    </div>
  );
}
