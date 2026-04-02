'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus } from 'lucide-react';
import { Tier, useTierStore } from '@/lib/store/tier-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { uploadPicktyImages } from '@/lib/image-upload-api';
import {
  contrastTextForHex,
  shouldResetPaintMatWhenAddingFirstLabelImage,
  tierHasBackgroundImage,
} from '@/lib/tier-label-surface';
import { TierLabelCellView } from '@/components/tier/tier-label-cell-view';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { PICKTY_IMAGE_ACCEPT } from '@/lib/pickty-image-accept';
import { TIER_COLOR_PRESETS } from '@/lib/tier-color-presets';

/** 한글/CJK 포함 시 최대 3자, 영어·숫자만이면 최대 5자 */
function isWithinLabelLimit(s: string): boolean {
  const hasCJK = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(s);
  return s.length <= (hasCJK ? 3 : 5);
}

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

/**
 * 모달 안 라벨 미리보기 박스 배경 — 실제 표배경(`workspaceBoardSurface`)을 쓰지 않음.
 * 작은 영역에 보드 배경 이미지를 cover로 넣으면 본문 캐릭터가 축소돼 라벨 이미지와 겹쳐 보임.
 */
const MODAL_LABEL_PREVIEW_BG_CLASS = 'bg-slate-200 dark:bg-zinc-700';

/** 저장된 글자색이 없을 때 모달 초기값(한 번 고르면 그대로 저장됨) */
function initialLabelTextColor(tier: Tier): string {
  const t = tier.textColor?.trim();
  if (t && HEX6.test(t)) return t;
  if (tierHasBackgroundImage(tier)) return '#ffffff';
  return contrastTextForHex(tier.color);
}

interface TierSettingsModalProps {
  tier: Tier;
  onClose: () => void;
  /**
   * false: 티어표 플레이(`/tier`) — 라벨 칸 이미지 업로드·제거 UI 숨김(텍스트·프리셋 색만).
   * true: 템플릿 도화지 등 제작 맥락 — 기존과 동일.
   */
  allowLabelImageUpload?: boolean;
}

export function TierSettingsModal({
  tier,
  onClose,
  allowLabelImageUpload = true,
}: TierSettingsModalProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { updateTier, addTierRow, deleteTierRow, clearTierRow } = useTierStore();
  const [label, setLabel] = useState(tier.label);
  const [color, setColor] = useState(tier.color);
  const [textColor, setTextColor] = useState(() => initialLabelTextColor(tier));
  /** 상단 토글 — 아래 팔레트가 배경용인지 글자용인지 */
  const [colorEditTab, setColorEditTab] = useState<'background' | 'text'>('background');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** false면 라벨 칸 단색/이미지 아래 매트 없음(표배경만) — 팔레트 첫 칸「없음」 */
  const [showLabelSolid, setShowLabelSolid] = useState(() => tier.showLabelColor !== false);
  /** 같은 hex를 다시 고를 때(특히 첫 프리셋)에도 라벨 배경 켜짐을 반영하기 위함 */
  const [labelBgPaletteInteracted, setLabelBgPaletteInteracted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const previewShowsLabelFill = showLabelSolid
    ? tier.showLabelColor !== false ||
      color !== tier.color ||
      tierHasBackgroundImage(tier) ||
      labelBgPaletteInteracted
    : false;

  const previewTier: Tier = {
    ...tier,
    label,
    color,
    textColor,
    paintLabelColorUnderImage: tierHasBackgroundImage(tier) ? true : tier.paintLabelColorUnderImage,
    showLabelColor: previewShowsLabelFill,
  };

  // ESC로 닫기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // 열릴 때 입력 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setLabel(tier.label);
    setColor(tier.color);
    setTextColor(initialLabelTextColor(tier));
    setShowLabelSolid(tier.showLabelColor !== false);
    setColorEditTab('background');
    setLabelBgPaletteInteracted(false);
  }, [tier.id]);

  const handleApply = () => {
    const trimmed = label.trim();
    if (trimmed) {
      const showLabelColor = showLabelSolid
        ? tier.showLabelColor !== false ||
          color !== tier.color ||
          tierHasBackgroundImage(tier) ||
          labelBgPaletteInteracted
        : false;
      updateTier(tier.id, {
        label: trimmed,
        color,
        textColor,
        showLabelColor,
        paintLabelColorUnderImage: tierHasBackgroundImage(tier) ? true : undefined,
      });
    }
    onClose();
  };

  const handleBackgroundFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!accessToken) {
      setUploadError('배경 이미지 업로드는 로그인 후 이용할 수 있습니다.');
      return;
    }
    setUploadError(null);
    setUploadBusy(true);
    try {
      const [url] = await uploadPicktyImages([file], accessToken);
      updateTier(tier.id, {
        backgroundUrl: url,
        ...(shouldResetPaintMatWhenAddingFirstLabelImage(tier)
          ? { paintLabelColorUnderImage: undefined }
          : {}),
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.';
      setUploadError(msg);
    } finally {
      setUploadBusy(false);
    }
  };

  const handleRemoveBackground = () => {
    setUploadError(null);
    updateTier(tier.id, { backgroundUrl: undefined });
  };

  const handleAddAbove = () => {
    addTierRow(tier.id, 'above');
    onClose();
  };

  const handleAddBelow = () => {
    addTierRow(tier.id, 'below');
    onClose();
  };

  const handleClear = () => {
    clearTierRow(tier.id);
    onClose();
  };

  const handleDelete = () => {
    deleteTierRow(tier.id);
    onClose();
  };

  const modal = (
    /* body 포털 — DnD·폼·도화지 레이어와 스택/포인터 분리 */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tier-settings-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-2xl shadow-black/60 overflow-hidden touch-manipulation"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div
              className={[
                'relative h-5 w-5 shrink-0 overflow-hidden rounded-sm border border-black/10 dark:border-white/10',
                MODAL_LABEL_PREVIEW_BG_CLASS,
              ].join(' ')}
            >
              <TierLabelCellView
                tier={{ ...previewTier, label: label.slice(0, 1) || '?' }}
                compact
                textClassName="text-[0.55rem] font-black leading-none"
              />
            </div>
            <span
              id="tier-settings-title"
              className="text-sm font-semibold text-slate-800 dark:text-zinc-200"
            >
              티어 설정
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors text-lg leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="p-4 flex flex-col gap-5">
          {/* ① 최상단: 편집 대상 토글 */}
          <div className="flex rounded-lg border border-slate-200 dark:border-zinc-700 p-0.5">
            <button
              type="button"
              onClick={() => setColorEditTab('background')}
              className={[
                'flex-1 rounded-md py-2 text-xs font-semibold transition-colors',
                colorEditTab === 'background'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800',
              ].join(' ')}
            >
              라벨 배경 색
            </button>
            <button
              type="button"
              onClick={() => setColorEditTab('text')}
              className={[
                'flex-1 rounded-md py-2 text-xs font-semibold transition-colors',
                colorEditTab === 'text'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800',
              ].join(' ')}
            >
              라벨 글자 색
            </button>
          </div>

          {/* ② 미리보기 스와치 — 배경 | 글자 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setColorEditTab('background')}
              className={[
                'flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors text-left',
                colorEditTab === 'background'
                  ? 'border-violet-500 bg-violet-50/60 dark:border-violet-500 dark:bg-violet-950/25'
                  : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600',
              ].join(' ')}
            >
              <span className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                라벨 배경 색
              </span>
              <div
                className={[
                  'relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-black/15 dark:border-white/15 shadow-inner',
                  MODAL_LABEL_PREVIEW_BG_CLASS,
                ].join(' ')}
                aria-hidden
              >
                <TierLabelCellView
                  tier={previewTier}
                  compact
                  textClassName="text-lg font-black opacity-0"
                />
              </div>
            </button>
            <button
              type="button"
              onClick={() => setColorEditTab('text')}
              className={[
                'flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors text-left',
                colorEditTab === 'text'
                  ? 'border-violet-500 bg-violet-50/60 dark:border-violet-500 dark:bg-violet-950/25'
                  : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600',
              ].join(' ')}
            >
              <span className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                라벨 글자 색
              </span>
              <div
                className="h-11 w-11 shrink-0 rounded-lg border border-black/15 dark:border-white/15 shadow-inner"
                style={{ backgroundColor: textColor }}
                aria-hidden
              />
            </button>
          </div>

          {/* ③ 팔레트 — 배경·글자 공용 */}
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2.5">
              팔레트
            </p>
            <div className="flex flex-wrap gap-2">
              {colorEditTab === 'background' && (
                <button
                  type="button"
                  title="라벨 배경 없음 (표배경만)"
                  onClick={() => setShowLabelSolid(false)}
                  className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-100',
                    'border-dashed bg-slate-100/90 dark:bg-zinc-800/90',
                    !showLabelSolid
                      ? 'scale-110 border-slate-900 shadow-md dark:border-white'
                      : 'border-slate-400 hover:border-slate-600 dark:border-zinc-600 dark:hover:border-zinc-400',
                  ].join(' ')}
                >
                  <Minus className="h-3.5 w-3.5 text-slate-600 dark:text-zinc-400" strokeWidth={2.5} aria-hidden />
                </button>
              )}
              {TIER_COLOR_PRESETS.map((preset) => {
                const active =
                  colorEditTab === 'background'
                    ? showLabelSolid && color.toLowerCase() === preset.toLowerCase()
                    : colorEditTab === 'text' && textColor === preset;
                return (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => {
                      if (colorEditTab === 'background') {
                        setShowLabelSolid(true);
                        setLabelBgPaletteInteracted(true);
                        setColor(preset);
                      } else {
                        setTextColor(preset);
                      }
                    }}
                    title={preset}
                    className={[
                      'w-7 h-7 rounded-full transition-all duration-100',
                      'border-2 hover:scale-110 active:scale-95',
                      active
                        ? 'border-slate-900 dark:border-white scale-110 shadow-lg'
                        : 'border-transparent hover:border-black/20 dark:hover:border-white/40',
                    ].join(' ')}
                    style={{ backgroundColor: preset }}
                  />
                );
              })}
              <label
                className="w-7 h-7 rounded-full border-2 border-slate-400 dark:border-zinc-600 hover:border-slate-600 dark:hover:border-zinc-400 flex items-center justify-center cursor-pointer transition-colors overflow-hidden relative"
                title="직접 입력"
              >
                <input
                  type="color"
                  value={colorEditTab === 'background' ? color : textColor}
                  onChange={(e) => {
                    if (colorEditTab === 'background') {
                      setShowLabelSolid(true);
                      setLabelBgPaletteInteracted(true);
                      setColor(e.target.value);
                    } else {
                      setTextColor(e.target.value);
                    }
                  }}
                  className="opacity-0 absolute w-0 h-0"
                />
                <span className="text-slate-500 dark:text-zinc-400 text-xs pointer-events-none">+</span>
              </label>
            </div>
          </div>

          {/* 라벨 칸 이미지 — 템플릿 제작 맥락에서만 */}
          {allowLabelImageUpload ? (
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2.5">
                배경 이미지
              </p>
              {tierHasBackgroundImage(tier) && (
                <div className="mb-2 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden h-16 bg-slate-100 dark:bg-zinc-800">
                  <img
                    src={picktyImageDisplaySrc(tier.backgroundUrl!.trim())}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input
                  ref={bgFileRef}
                  type="file"
                  accept={PICKTY_IMAGE_ACCEPT}
                  className="hidden"
                  disabled={uploadBusy || !accessToken}
                  onChange={handleBackgroundFile}
                />
                <button
                  type="button"
                  disabled={uploadBusy || !accessToken}
                  onClick={() => bgFileRef.current?.click()}
                  className={[
                    'w-full py-2 rounded-lg text-sm font-medium border transition-colors',
                    uploadBusy || !accessToken
                      ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-zinc-700 text-slate-400'
                      : 'border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800',
                  ].join(' ')}
                >
                  {uploadBusy ? '업로드 중…' : '이미지 파일 선택'}
                </button>
                {tierHasBackgroundImage(tier) && (
                  <button
                    type="button"
                    disabled={uploadBusy}
                    onClick={handleRemoveBackground}
                    className={[
                      'w-full py-2 rounded-lg text-sm font-medium border transition-colors',
                      'border-slate-300 dark:border-zinc-600 text-slate-600 dark:text-zinc-400',
                      'hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 hover:border-red-200 dark:hover:border-red-900',
                      uploadBusy ? 'opacity-50 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    배경 이미지 제거
                  </button>
                )}
                {!accessToken && (
                  <p className="text-xs text-amber-700 dark:text-amber-300/90">
                    로그인한 계정에서만 업로드할 수 있습니다.
                  </p>
                )}
                {uploadError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
                )}
              </div>
            </div>
          ) : null}

          {/* 라벨 입력 */}
          <div>
            <div className="flex gap-2 items-center">
              <div
                className={[
                  'relative h-8 w-8 shrink-0 overflow-hidden rounded border border-black/10 dark:border-white/10',
                  MODAL_LABEL_PREVIEW_BG_CLASS,
                ].join(' ')}
              >
                <TierLabelCellView
                  tier={{ ...previewTier, label: label.slice(0, 2) || '?' }}
                  compact
                  textClassName="text-base font-black"
                />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={label}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isWithinLabelLimit(val)) setLabel(val);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApply();
                }}
                maxLength={5}
                placeholder="S, A, B..."
                className={[
                  'flex-1 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-1.5',
                  'text-sm text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600',
                  'focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40',
                  'transition-colors',
                ].join(' ')}
              />
              <button
                type="button"
                onClick={handleApply}
                className={[
                  'shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium',
                  'bg-violet-600 hover:bg-violet-500 text-white',
                  'transition-colors active:scale-95',
                ].join(' ')}
              >
                적용
              </button>
            </div>
            {/* 각 요소 아래 캡션 */}
            <div className="flex gap-2 mt-1.5">
              <div className="w-8 shrink-0 flex justify-center">
                <span className="text-xs text-slate-500 dark:text-zinc-600">라벨</span>
              </div>
              <div className="flex-1" />
              <span className="text-xs text-slate-500 dark:text-zinc-600 flex items-center gap-0.5">
                <span>↵</span>
                <span>Enter</span>
              </span>
            </div>
          </div>

          {/* 구분선 */}
          <div className="border-t border-slate-100 dark:border-zinc-800" />

          {/* 액션 버튼 4개 */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleAddAbove}
                className={[
                  'flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg',
                  'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700',
                  'text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100',
                  'border border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500',
                  'transition-all active:scale-95',
                ].join(' ')}
              >
                <span className="text-base leading-none">↑</span>
                <span className="text-xs">위에 행 추가</span>
              </button>
              <button
                type="button"
                onClick={handleAddBelow}
                className={[
                  'flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg',
                  'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700',
                  'text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100',
                  'border border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500',
                  'transition-all active:scale-95',
                ].join(' ')}
              >
                <span className="text-base leading-none">↓</span>
                <span className="text-xs">아래 행 추가</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className={[
                'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm',
                'bg-slate-100 dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-900/60',
                'text-slate-700 dark:text-zinc-300 hover:text-amber-700 dark:hover:text-amber-200',
                'border border-slate-300 dark:border-zinc-700 hover:border-amber-400 dark:hover:border-amber-700/60',
                'transition-all active:scale-95',
              ].join(' ')}
            >
              <span className="text-base leading-none">⊘</span>
              행 비우기 (아이템 미분류로)
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className={[
                'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm',
                'bg-slate-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/60',
                'text-slate-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-300',
                'border border-slate-300 dark:border-zinc-700 hover:border-red-300 dark:hover:border-red-800/60',
                'transition-all active:scale-95',
              ].join(' ')}
            >
              <span className="text-base leading-none">🗑</span>
              행 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
