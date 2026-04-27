'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AlertCircle, Loader2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  AiGenerationQuotaExhaustedError,
  type AiMediaCandidateDto,
  type AiMediaTypeWire,
  postAiAutoGenerate,
} from '@/lib/ai-generation-api';
import { fetchAdminAiUsage } from '@/lib/admin-ai-usage-api';

const COUNT_MIN = 1;
const COUNT_MAX = 100;
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
  /** 에디터에 이미 등록된 아이템 이름(빈 이름 행은 부모에서 제외해 전달 권장) */
  existingItemNames?: string[];
  inputPlaceholder?: string;
  generateButtonLabel?: string;
  hintText?: string;
  /** true일 때만 PT 기준 외부 API 사용량을 조회·표시한다. */
  isAdmin?: boolean;
  /** true면 미디어는 항상 사진(PHOTO)만 사용. 움짤·유튜브 버튼은 비활성화된다. */
  lockMediaTypeToPhoto?: boolean;
  /** 지정하면 해당 미디어 타입만 사용하고 나머지 버튼은 비활성화된다. */
  lockedMediaType?: AiMediaTypeWire;
};

const LOADING_TEXT_INITIAL = 'AI가 후보를 생성하고 있습니다...';

const MSG_AI_DAILY_QUOTA_EXHAUSTED =
  '오늘의 AI 자동 생성 할당량(20회)이 모두 소진되었습니다.';

const USAGE_LIMIT_GEMINI = 20;
const USAGE_LIMIT_YOUTUBE = 100;
const USAGE_LIMIT_GOOGLE = 100;

const TOOLTIP_PT_RESET =
  '태평양 표준시 자정(한국 시간 오후 4~5시) 기준으로 할당량이 초기화됩니다.';

const MEDIA_OPTIONS: { value: AiMediaTypeWire; label: string }[] = [
  { value: 'PHOTO', label: '사진' },
  { value: 'GIF', label: '움짤' },
  { value: 'YOUTUBE', label: '유튜브' },
];

/**
 * 주제·미디어 타입으로 후보를 자동 채우는 UI.
 * 호출하는 페이지에서 권한 가드(예: ADMIN)를 두는 것을 전제로 한다.
 */
function normalizeExistingItemNamesForApi(names: string[] | undefined): string[] {
  if (!names?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim();
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out.slice(0, 200);
}

export function AiGenerationPanel({
  accessToken,
  onGenerated,
  existingItemNames = [],
  inputPlaceholder = '주제 입력',
  generateButtonLabel = 'AI로 후보 생성',
  hintText = 'Gemini로 이름을 만들고, 선택한 미디어 종류에 맞춰 검색 후보 URL을 채웁니다. 개수는 1~100까지 조절할 수 있어요. 약 수 초~1분 가까이 걸릴 수 있습니다.',
  isAdmin = false,
  lockMediaTypeToPhoto = false,
  lockedMediaType,
}: AiGenerationPanelProps) {
  const { data: adminUsage, mutate: mutateAdminUsage } = useSWR(
    isAdmin && accessToken ? (['admin-ai-usage', accessToken] as const) : null,
    ([, token]) => fetchAdminAiUsage(token),
    { revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 86_400_000 },
  );

  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [itemCountDraft, setItemCountDraft] = useState(String(COUNT_DEFAULT));
  const [mediaType, setMediaType] = useState<AiMediaTypeWire>('PHOTO');
  const [aiError, setAiError] = useState<string | null>(null);

  const effectiveMediaType: AiMediaTypeWire = lockedMediaType ?? (lockMediaTypeToPhoto ? 'PHOTO' : mediaType);

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
        existingItemNames: normalizeExistingItemNamesForApi(existingItemNames),
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
      if (isAdmin) void mutateAdminUsage();
    } catch (err) {
      if (err instanceof AiGenerationQuotaExhaustedError) {
        toast.error(MSG_AI_DAILY_QUOTA_EXHAUSTED);
        if (isAdmin) void mutateAdminUsage();
        return;
      }
      setAiError(err instanceof Error ? err.message : 'AI 생성 중 오류가 발생했습니다.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-violet-100 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-none">
      <div className="flex flex-col gap-3 [color-scheme:light] dark:[color-scheme:dark]">
        <div className="flex min-h-4 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {isAdmin && adminUsage ? (
            <p className="min-w-0 text-xs text-slate-600 dark:text-zinc-300">
              <span aria-hidden>💡 </span>
              오늘 API 사용량: {/*Gemini {adminUsage.gemini}/{USAGE_LIMIT_GEMINI} · */}YouTube {adminUsage.youtube}/
              {USAGE_LIMIT_YOUTUBE} · Google {adminUsage.googleSearch}/{USAGE_LIMIT_GOOGLE}{' '}
              <span
                className="cursor-help select-none text-violet-600 dark:text-violet-400"
                title={TOOLTIP_PT_RESET}
                aria-label={TOOLTIP_PT_RESET}
              >
                ⓘ
              </span>
            </p>
          ) : null}
          {isAiGenerating ? (
            <p
              className="shrink-0 text-right text-xs leading-snug text-slate-500 dark:text-zinc-400"
              aria-live="polite"
              aria-busy="true"
            >
              {LOADING_TEXT_INITIAL}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-3">
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
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-violet-400 dark:focus:ring-violet-400/35"
            />
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500">
              <Sparkles className="h-4 w-4" aria-hidden />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label
              htmlFor="ai-generation-item-count"
              className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-zinc-300"
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
              className="w-[4.25rem] shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-center text-sm font-mono tabular-nums text-slate-900 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-violet-400 dark:focus:ring-violet-400/35"
              aria-label="생성할 아이템 개수 (1~100)"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAiGenerate()}
            disabled={isAiGenerating || !aiPrompt.trim()}
            aria-busy={isAiGenerating}
            aria-label={isAiGenerating ? 'AI 후보 생성 중' : generateButtonLabel}
            className="relative inline-flex w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:pointer-events-none disabled:opacity-60 dark:bg-violet-600 dark:hover:bg-violet-500 sm:w-auto"
          >
            <span
              className={['inline-flex items-center justify-center gap-2', isAiGenerating ? 'invisible' : ''].join(
                ' ',
              )}
              aria-hidden={isAiGenerating}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              {generateButtonLabel}
            </span>
            {isAiGenerating ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              </span>
            ) : null}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">미디어 종류</span>
          {MEDIA_OPTIONS.map((opt) => {
            const isSelected = effectiveMediaType === opt.value
            const isLockedOut = Boolean(lockedMediaType)
              ? opt.value !== lockedMediaType
              : lockMediaTypeToPhoto && opt.value !== 'PHOTO'
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isAiGenerating || isLockedOut}
                onClick={() => setMediaType(opt.value)}
                className={[
                  'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                  isSelected
                    ? 'border-violet-500 bg-violet-50 text-violet-800 shadow-sm dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-100 dark:shadow-[0_0_0_1px_rgba(167,139,250,0.25)]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/90',
                  isLockedOut
                    ? 'cursor-not-allowed opacity-45 hover:border-slate-200 hover:bg-white dark:hover:border-zinc-600 dark:hover:bg-zinc-950'
                    : '',
                ].join(' ')}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-[0.7rem] leading-relaxed text-slate-500 dark:text-zinc-400">{hintText}</p>

      {aiError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[0.7rem] text-red-800 dark:border-red-500/35 dark:bg-red-950/40 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-300" aria-hidden />
          <span>{aiError}</span>
        </div>
      )}
    </div>
  );
}
