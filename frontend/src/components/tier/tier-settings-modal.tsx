'use client';

import { useEffect, useRef, useState } from 'react';
import { Tier } from '@/lib/store/tier-store';
import { useTierStore } from '@/lib/store/tier-store';

/** 한글/CJK 포함 시 최대 3자, 영어·숫자만이면 최대 5자 */
function isWithinLabelLimit(s: string): boolean {
  const hasCJK = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(s);
  return s.length <= (hasCJK ? 3 : 5);
}

const COLOR_PRESETS = [
  '#FF7F7F',
  '#FFBF7F',
  '#FFDF7F',
  '#BFFF7F',
  '#7FFF7F',
  '#7FFFFF',
  '#7FBFFF',
  '#BF7FFF',
  '#FF7FBF',
  '#FF4444',
  '#FFAA00',
  '#44DD44',
  '#FFFFFF',
  '#AAAAAA',
  '#555555',
];

interface TierSettingsModalProps {
  tier: Tier;
  onClose: () => void;
}

export function TierSettingsModal({ tier, onClose }: TierSettingsModalProps) {
  const { updateTier, addTierRow, deleteTierRow, clearTierRow } = useTierStore();
  const [label, setLabel] = useState(tier.label);
  const [color, setColor] = useState(tier.color);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleApply = () => {
    const trimmed = label.trim();
    if (trimmed) updateTier(tier.id, { label: trimmed, color });
    onClose();
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

  return (
    /* 배경 오버레이 */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* 모달 패널 — 터치/포인터에서도 배경 닫기와 충돌 방지 */}
      <div
        className="w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-2xl shadow-black/60 overflow-hidden touch-manipulation"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div
              className="w-5 h-5 rounded-sm shrink-0 border border-black/10 dark:border-white/10"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
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
          {/* 색상 팔레트 */}
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-2.5">
              색상
            </p>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setColor(preset)}
                  title={preset}
                  className={[
                    'w-7 h-7 rounded-full transition-all duration-100',
                    'border-2 hover:scale-110 active:scale-95',
                    color === preset
                      ? 'border-slate-900 dark:border-white scale-110 shadow-lg'
                      : 'border-transparent hover:border-black/20 dark:hover:border-white/40',
                  ].join(' ')}
                  style={{ backgroundColor: preset }}
                />
              ))}
              {/* 커스텀 색상 피커 */}
              <label
                className="w-7 h-7 rounded-full border-2 border-slate-400 dark:border-zinc-600 hover:border-slate-600 dark:hover:border-zinc-400 flex items-center justify-center cursor-pointer transition-colors overflow-hidden"
                title="직접 입력"
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="opacity-0 absolute w-0 h-0"
                />
                <span className="text-slate-500 dark:text-zinc-400 text-xs pointer-events-none">+</span>
              </label>
            </div>
          </div>

          {/* 라벨 입력 */}
          <div>
            <div className="flex gap-2 items-center">
              <div
                className="w-8 h-8 rounded flex items-center justify-center text-base font-black text-zinc-900 shrink-0 border border-black/10 dark:border-white/10"
                style={{ backgroundColor: color }}
              >
                {label.slice(0, 2) || '?'}
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
}
