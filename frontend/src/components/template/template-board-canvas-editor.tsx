'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Image as ImageIcon, ImagePlus, Palette, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { type Tier, type TierItem, useTierStore } from '@/lib/store/tier-store';
import { uploadPicktyImages } from '@/lib/image-upload-api';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import {
  createDefaultTemplateBoardConfig,
  type TemplateBoardSurface,
} from '@/lib/template-board-config';
import { PICKTY_IMAGE_ACCEPT } from '@/lib/pickty-image-accept';
import { TIER_COLOR_PRESETS } from '@/lib/tier-color-presets';
import {
  getTierLabelSolidCellStyle,
  getTierLabelTextStyle,
  shouldResetPaintMatWhenAddingFirstLabelImage,
  tierHasBackgroundImage,
} from '@/lib/tier-label-surface';
import { TierLabelCellView } from '@/components/tier/tier-label-cell-view';
import { TierSettingsModal } from '@/components/tier/tier-settings-modal';

function DragHandleIcon() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor" aria-hidden>
      <rect x="0" y="0" width="14" height="2" rx="1" />
      <rect x="0" y="5" width="14" height="2" rx="1" />
      <rect x="0" y="10" width="14" height="2" rx="1" />
    </svg>
  );
}

/** 티어 행 라벨 칸 — 실제 `TierRow`와 동일 80×80 근사, 미리보기/메이커와 동일 UX */
function CanvasEditorLabelCell({
  tier,
  accessToken,
  onError,
}: {
  tier: Tier;
  accessToken: string;
  onError: (msg: string | null) => void;
}) {
  const updateTier = useTierStore((s) => s.updateTier);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const hasImg = tierHasBackgroundImage(tier);

  const runUpload = async (file: File) => {
    onError(null);
    setBusy(true);
    try {
      const [url] = await uploadPicktyImages([file], accessToken);
      if (url) {
        updateTier(tier.id, {
          backgroundUrl: url,
          ...(shouldResetPaintMatWhenAddingFirstLabelImage(tier)
            ? { paintLabelColorUnderImage: undefined }
            : {}),
        });
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (hasImg) {
    return (
      <div
        className="pointer-events-auto relative w-20 min-w-[80px] shrink-0 min-h-20 overflow-hidden group"
        aria-busy={busy}
      >
        <input
          ref={inputRef}
          type="file"
          accept={PICKTY_IMAGE_ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void runUpload(f);
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <TierLabelCellView tier={tier} />
        </div>
        <div className="absolute inset-0 z-[2] flex items-center justify-center gap-1 bg-black/0 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="rounded border border-white/80 bg-white/90 px-1.5 py-0.5 text-[0.65rem] font-medium text-slate-800"
          >
            수정
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              updateTier(tier.id, { backgroundUrl: undefined });
            }}
            className="rounded border border-white/60 bg-red-600/90 px-1.5 py-0.5 text-[0.65rem] font-medium text-white"
          >
            삭제
          </button>
        </div>
      </div>
    );
  }

  const solidStyle = getTierLabelSolidCellStyle(tier);
  const textStyle = getTierLabelTextStyle(tier);
  const paintsLabelFill = tier.showLabelColor !== false;

  return (
    <div className="pointer-events-auto relative w-20 min-w-[80px] shrink-0 min-h-20 overflow-hidden" aria-busy={busy}>
      <input
        ref={inputRef}
        type="file"
        accept={PICKTY_IMAGE_ACCEPT}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void runUpload(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        style={solidStyle}
        className={[
          'flex h-full min-h-20 w-full flex-col items-center justify-center gap-0.5 px-0.5',
          'border-2 border-dashed text-[0.65rem] font-semibold transition-colors',
          paintsLabelFill
            ? [
                'border-black/25 hover:border-violet-500 hover:brightness-[0.97]',
                'dark:border-white/25 dark:hover:border-violet-400 dark:hover:brightness-110',
              ].join(' ')
            : [
                'border-slate-400/90 bg-transparent text-slate-600',
                'hover:border-violet-500 hover:bg-violet-50/40 hover:text-violet-800',
                'dark:border-zinc-500 dark:hover:border-violet-400 dark:hover:bg-violet-950/25',
              ].join(' '),
          'disabled:opacity-50',
        ].join(' ')}
        aria-label={`${tier.label} 행 배경 이미지 업로드`}
      >
        <div
          className="flex flex-col items-center justify-center gap-0.5"
          style={{
            color: textStyle.color,
            ...(textStyle.textShadow ? { textShadow: textStyle.textShadow } : {}),
          }}
        >
          <ImagePlus className="h-4 w-4 shrink-0 opacity-85" strokeWidth={1.75} aria-hidden />
          <span className="line-clamp-3 max-w-full break-all text-center text-lg font-black leading-tight tracking-tight">
            {tier.label}
          </span>
        </div>
      </button>
    </div>
  );
}

function CanvasEditorRow({
  tier,
  accessToken,
}: {
  tier: Tier;
  accessToken: string;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [labelErr, setLabelErr] = useState<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tier.id, data: { type: 'canvas-tier-row' } });

  const rowStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 80, position: 'relative' } : {}),
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={rowStyle}
        className={[
          'relative flex min-h-[5rem] w-full items-stretch pointer-events-none',
          isDragging ? 'z-[80] opacity-60' : '',
        ].join(' ')}
      >
        <div className="pointer-events-auto flex w-20 min-w-[80px] shrink-0 flex-col items-stretch justify-center">
          <CanvasEditorLabelCell tier={tier} accessToken={accessToken} onError={setLabelErr} />
          {labelErr ? (
            <p className="mt-0.5 max-w-[5rem] text-center text-[0.55rem] leading-tight text-red-500 dark:text-red-400">
              {labelErr}
            </p>
          ) : null}
        </div>

        <div className="min-h-[5rem] min-w-0 flex-1 pointer-events-none" aria-hidden />

        <div className="pointer-events-auto flex w-16 shrink-0 items-stretch border-l border-slate-200/60 dark:border-zinc-700/80">
          <button
            type="button"
            className="flex w-8 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300"
            title="티어 설정"
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen(true);
            }}
          >
            ⚙
          </button>
          <button
            type="button"
            {...listeners}
            {...attributes}
            className="flex w-8 cursor-grab touch-none items-center justify-center border-l border-slate-200/60 text-slate-400 active:cursor-grabbing dark:border-zinc-700/80 dark:text-zinc-500 dark:hover:text-zinc-300"
            title="순서 변경"
            tabIndex={-1}
          >
            <DragHandleIcon />
          </button>
        </div>
      </div>

      {settingsOpen && <TierSettingsModal tier={tier} onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

function mergeBoardSurface(
  prev: TemplateBoardSurface | null,
  patch: Partial<TemplateBoardSurface>,
): TemplateBoardSurface | null {
  const next = { ...(prev ?? {}), ...patch };
  const has =
    (typeof next.backgroundColor === 'string' && next.backgroundColor.trim()) ||
    (typeof next.backgroundUrl === 'string' && next.backgroundUrl.trim());
  return has ? next : null;
}

export function TemplateBoardCanvasEditor({
  formTierEntries,
}: {
  /** 폼 아이템 → 미리보기 풀 재동기화용 */
  formTierEntries: TierItem[];
}) {
  const accessToken = useAuthStore((s) => s.accessToken) ?? '';
  const tiers = useTierStore((s) => s.tiers);
  const workspaceBoardSurface = useTierStore((s) => s.workspaceBoardSurface);
  const reorderTiers = useTierStore((s) => s.reorderTiers);
  const addTierRow = useTierStore((s) => s.addTierRow);
  const initTemplateBoardEditor = useTierStore((s) => s.initTemplateBoardEditor);
  const syncTemplatePreviewPoolFromForm = useTierStore((s) => s.syncTemplatePreviewPoolFromForm);
  const setWorkspaceBoardSurface = useTierStore((s) => s.setWorkspaceBoardSurface);

  const boardInputRef = useRef<HTMLInputElement>(null);
  const boardColorInputRef = useRef<HTMLInputElement>(null);
  const boardBgPaletteWrapRef = useRef<HTMLDivElement>(null);
  const boardInputId = useId();
  const [boardBusy, setBoardBusy] = useState(false);
  const [boardErr, setBoardErr] = useState<string | null>(null);
  const [boardBgPaletteOpen, setBoardBgPaletteOpen] = useState(false);

  const bu = workspaceBoardSurface?.backgroundUrl?.trim();
  const bc = workspaceBoardSurface?.backgroundColor?.trim();
  const hasBoardImage = Boolean(bu);
  const hasBoardColor = Boolean(bc);
  const hasBoardVisual = hasBoardImage || hasBoardColor;
  const isEmptyBoardSurface = !hasBoardVisual;
  const colorInputValue =
    bc && /^#[0-9A-Fa-f]{6}$/.test(bc.trim()) ? bc.trim() : '#f1f5f9';

  const surfaceStyle: React.CSSProperties = {};
  if (bc) surfaceStyle.backgroundColor = bc;
  if (bu) {
    surfaceStyle.backgroundImage = `url("${picktyImageDisplaySrc(bu)}")`;
    surfaceStyle.backgroundSize = 'cover';
    surfaceStyle.backgroundPosition = 'center';
    surfaceStyle.backgroundRepeat = 'no-repeat';
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      reorderTiers(active.id as string, over.id as string);
    }
  };

  const runBoardUpload = async (file: File) => {
    if (!accessToken) return;
    setBoardErr(null);
    setBoardBusy(true);
    try {
      const [url] = await uploadPicktyImages([file], accessToken);
      if (url) {
        setWorkspaceBoardSurface(
          mergeBoardSurface(useTierStore.getState().workspaceBoardSurface, { backgroundUrl: url }),
        );
      }
    } catch (err) {
      setBoardErr(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setBoardBusy(false);
    }
  };

  const clearBoardSurface = useCallback(() => {
    setWorkspaceBoardSurface(null);
  }, [setWorkspaceBoardSurface]);

  const applyBoardBackgroundColor = useCallback(
    (hex: string) => {
      const t = hex.trim();
      if (!/^#[0-9A-Fa-f]{6}$/.test(t)) return;
      setWorkspaceBoardSurface(
        mergeBoardSurface(useTierStore.getState().workspaceBoardSurface, {
          backgroundColor: t,
        }),
      );
    },
    [setWorkspaceBoardSurface],
  );

  useEffect(() => {
    if (!boardBgPaletteOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = boardBgPaletteWrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setBoardBgPaletteOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBoardBgPaletteOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [boardBgPaletteOpen]);

  const onResetDefaults = () => {
    initTemplateBoardEditor(createDefaultTemplateBoardConfig({ revealLabelColors: true }));
    syncTemplatePreviewPoolFromForm(formTierEntries);
  };

  const lastTierId = tiers[tiers.length - 1]?.id;
  const canAddRow = tiers.length < 20;

  const tierIds = tiers.map((t) => t.id);

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-50/90 to-white px-4 py-5 dark:from-zinc-900/80 dark:to-zinc-950">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
          도화지
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
          가운데 영역을 눌러 표배경 이미지를 올리거나, 우측 상단에서 배경색을 고를 수 있어요. 행마다 아이콘으로
          라벨배경을 올릴 수 있어요.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onResetDefaults}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            기본 세팅
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragEnd={handleDragEnd}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
        <div className="relative overflow-hidden rounded-2xl">
          {/* 배경만 — 항상 아래 */}
          <div
            className="pointer-events-none absolute left-0 right-16 top-0 bottom-[3.25rem] z-[10] overflow-hidden rounded-xl"
            style={surfaceStyle}
          >
            {!hasBoardVisual ? (
              <div className="absolute inset-0 bg-slate-50/80 dark:bg-zinc-900/50" />
            ) : null}
          </div>

          {/* 표 영역 우측 상단 — 노션 스타일 플로팅 도구 (pointer-events-auto) */}
          {!boardBusy ? (
            <div
              className="pointer-events-none absolute left-0 right-16 top-0 bottom-[3.25rem] z-[40]"
              aria-label="표 배경 도구"
            >
              <div
                className={[
                  'pointer-events-auto absolute top-2 right-2 flex max-w-[min(100%,18rem)] flex-wrap items-center justify-end gap-0.5 rounded-xl border px-1 py-1 shadow-md backdrop-blur-md',
                  'border-slate-200/90 bg-white/90 dark:border-zinc-600/90 dark:bg-zinc-900/90',
                ].join(' ')}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {hasBoardVisual ? (
                  <>
                    <button
                      type="button"
                      disabled={!accessToken}
                      title={accessToken ? '표 배경 이미지 바꾸기' : '로그인 후 이미지 업로드'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (accessToken) boardInputRef.current?.click();
                      }}
                      className={[
                        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.7rem] font-medium transition-colors',
                        accessToken
                          ? 'text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800'
                          : 'cursor-not-allowed text-slate-400 dark:text-zinc-600',
                      ].join(' ')}
                    >
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                      배경 변경
                    </button>
                    <span
                      className="mx-0.5 h-3 w-px shrink-0 bg-slate-200 dark:bg-zinc-600"
                      aria-hidden
                    />
                  </>
                ) : null}
                <div ref={boardBgPaletteWrapRef} className="relative">
                  <button
                    type="button"
                    title="표 배경 색상"
                    aria-expanded={boardBgPaletteOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setBoardBgPaletteOpen((v) => !v);
                    }}
                    className={[
                      'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.7rem] font-medium transition-colors',
                      boardBgPaletteOpen
                        ? 'bg-slate-200 text-slate-900 dark:bg-zinc-700 dark:text-zinc-50'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800',
                    ].join(' ')}
                  >
                    <Palette className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                    배경색
                  </button>
                  {boardBgPaletteOpen ? (
                    <div
                      role="dialog"
                      aria-label="표 배경 색 팔레트"
                      className="absolute top-full right-0 z-[50] mt-1.5 min-w-[11rem] max-w-[15rem] rounded-xl border border-slate-200/95 bg-white/98 p-2.5 shadow-xl backdrop-blur-md dark:border-zinc-600 dark:bg-zinc-900/98"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-500">
                        팔레트
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {TIER_COLOR_PRESETS.map((preset) => {
                          const active =
                            Boolean(bc) && preset.toLowerCase() === (bc as string).toLowerCase();
                          return (
                            <button
                              type="button"
                              key={preset}
                              title={preset}
                              onClick={() => applyBoardBackgroundColor(preset)}
                              className={[
                                'h-7 w-7 rounded-full transition-all duration-100',
                                'border-2 hover:scale-110 active:scale-95',
                                active
                                  ? 'scale-110 border-slate-900 shadow-lg dark:border-white'
                                  : 'border-transparent hover:border-black/20 dark:hover:border-white/40',
                              ].join(' ')}
                              style={{ backgroundColor: preset }}
                            />
                          );
                        })}
                        <label
                          className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-slate-400 transition-colors hover:border-slate-600 dark:border-zinc-600 dark:hover:border-zinc-400"
                          title="직접 선택 · 스포이드(브라우저 지원 시)"
                        >
                          <input
                            ref={boardColorInputRef}
                            type="color"
                            value={colorInputValue}
                            onChange={(e) => applyBoardBackgroundColor(e.target.value)}
                            className="absolute h-0 w-0 opacity-0"
                            aria-label="표 배경 직접 색 선택"
                          />
                          <span className="pointer-events-none text-xs text-slate-500 dark:text-zinc-400">
                            +
                          </span>
                        </label>
                      </div>
                      <p className="mt-2 text-[0.6rem] leading-snug text-slate-400 dark:text-zinc-500">
                        + 를 누르면 시스템 색 창(스포이드 등)이 열려요
                      </p>
                    </div>
                  ) : null}
                </div>
                {hasBoardVisual ? (
                  <>
                    <span
                      className="mx-0.5 h-3 w-px shrink-0 bg-slate-200 dark:bg-zinc-600"
                      aria-hidden
                    />
                    <button
                      type="button"
                      title="표 배경(이미지·색) 모두 지우기"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearBoardSurface();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.7rem] font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                      지우기
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* 클릭 타깃: z-20. 행 레이어(z-30)가 pointer-events-none 이라 가운데는 여기로 이벤트가 내려옴. 플로팅(z-40) 아래는 비어 있어야 함 → z-25 */}
          {boardBusy ? (
            <div
              className="absolute left-0 right-16 top-0 bottom-[3.25rem] z-[25] cursor-wait rounded-xl bg-transparent"
              aria-hidden
            />
          ) : !accessToken ? (
            <div
              className={[
                'absolute left-0 right-16 top-0 bottom-[3.25rem] z-[25] flex cursor-default flex-col items-center justify-center rounded-xl px-4 text-center transition-colors',
                isEmptyBoardSurface
                  ? 'border-2 border-dashed border-slate-300/90 dark:border-zinc-600'
                  : 'border-2 border-transparent',
              ].join(' ')}
              aria-hidden={!isEmptyBoardSurface}
            >
              {isEmptyBoardSurface ? (
                <span className="pointer-events-none flex max-w-[16rem] flex-col items-center gap-2 text-slate-400 dark:text-zinc-500">
                  <ImageIcon className="h-8 w-8 opacity-70" strokeWidth={1.5} aria-hidden />
                  <span className="text-sm font-medium leading-snug">표 배경 이미지 업로드</span>
                  <span className="text-xs font-normal text-slate-400/90 dark:text-zinc-600">
                    로그인 후 이용할 수 있어요
                  </span>
                </span>
              ) : null}
            </div>
          ) : (
            <label
              htmlFor={boardInputId}
              className={[
                'absolute left-0 right-16 top-0 bottom-[3.25rem] z-[25] flex cursor-pointer items-center justify-center rounded-xl transition-colors',
                hasBoardVisual
                  ? 'border-2 border-transparent bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                  : 'border-2 border-dashed border-slate-300/90 bg-transparent hover:border-violet-400/80 dark:border-zinc-600 dark:hover:border-violet-500/70',
              ].join(' ')}
            >
              <span className="sr-only">표 전체 배경 이미지 업로드</span>
              {isEmptyBoardSurface ? (
                <span className="pointer-events-none flex flex-col items-center gap-2 text-slate-400/90 dark:text-zinc-500">
                  <ImageIcon className="h-8 w-8 opacity-70" strokeWidth={1.5} aria-hidden />
                  <span className="text-sm font-medium">표 배경 이미지 업로드</span>
                </span>
              ) : null}
            </label>
          )}

          <input
            id={boardInputId}
            ref={boardInputRef}
            type="file"
            accept={PICKTY_IMAGE_ACCEPT}
            className="sr-only"
            disabled={boardBusy || !accessToken}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void runBoardUpload(f);
            }}
          />

          <div className="relative z-[30] flex flex-col pointer-events-none">
            <SortableContext items={tierIds} strategy={verticalListSortingStrategy}>
              {tiers.map((tier) => (
                <CanvasEditorRow key={tier.id} tier={tier} accessToken={accessToken} />
              ))}
            </SortableContext>

            {lastTierId && (
              <button
                type="button"
                disabled={!canAddRow}
                onClick={() => addTierRow(lastTierId, 'below')}
                className={[
                  'pointer-events-auto relative z-[35] mt-1 flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300/80 text-sm font-medium text-slate-500 transition-colors',
                  'hover:border-violet-400 hover:text-violet-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-violet-500 dark:hover:text-violet-300',
                  !canAddRow ? 'cursor-not-allowed opacity-50' : '',
                ].join(' ')}
              >
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                행 추가
              </button>
            )}
          </div>
        </div>

        {boardErr ? (
          <p className="relative z-20 mt-2 text-center text-xs text-red-600 dark:text-red-400">
            {boardErr}
          </p>
        ) : null}
        {boardBusy ? (
          <p className="relative z-20 mt-1 text-center text-xs text-slate-500">업로드 중…</p>
        ) : null}
      </DndContext>
    </div>
  );
}
