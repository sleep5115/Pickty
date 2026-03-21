'use client';

import { RefObject, useEffect, useRef, useState } from 'react';

export interface DragSelectRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface UseDragSelectOptions {
  containerRef: RefObject<HTMLElement | null>;
  /** PC 모드이고 타겟팅 모드가 비활성화일 때만 true */
  enabled: boolean;
  onSelect: (itemIds: string[]) => void;
}

/**
 * 빈 공간을 마우스 드래그하여 [data-item-id] 요소를 범위 선택하는 훅.
 * 8px 미만의 드래그는 클릭으로 처리하여 선택을 트리거하지 않는다.
 */
export function useDragSelect({
  containerRef,
  enabled,
  onSelect,
}: UseDragSelectOptions) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [dragSelectRect, setDragSelectRect] = useState<DragSelectRect | null>(
    null,
  );

  useEffect(() => {
    if (!enabled) {
      startRef.current = null;
      setDragSelectRect(null);
      return;
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // 버튼(=아이템 카드, 라벨 등) 위에서는 범위 선택 시작하지 않음
      if (target.closest('button, [data-no-drag-select]')) return;
      const container = containerRef.current;
      if (!container?.contains(target)) return;

      startRef.current = { x: e.clientX, y: e.clientY };
      setDragSelectRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!startRef.current) return;
      const { x, y } = startRef.current;
      setDragSelectRect({
        left: Math.min(x, e.clientX),
        top: Math.min(y, e.clientY),
        width: Math.abs(e.clientX - x),
        height: Math.abs(e.clientY - y),
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!startRef.current) return;
      const { x, y } = startRef.current;
      startRef.current = null;
      setDragSelectRect(null);

      const minX = Math.min(x, e.clientX);
      const maxX = Math.max(x, e.clientX);
      const minY = Math.min(y, e.clientY);
      const maxY = Math.max(y, e.clientY);

      // 너무 작은 드래그는 무시 (클릭과 구분)
      if (maxX - minX < 8 && maxY - minY < 8) return;

      const selectedIds: string[] = [];
      document
        .querySelectorAll<HTMLElement>('[data-item-id]')
        .forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (
            rect.left < maxX &&
            rect.right > minX &&
            rect.top < maxY &&
            rect.bottom > minY
          ) {
            const itemId = el.getAttribute('data-item-id');
            if (itemId) selectedIds.push(itemId);
          }
        });

      if (selectedIds.length > 0) onSelect(selectedIds);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      startRef.current = null;
      setDragSelectRect(null);
    };
  }, [enabled, onSelect, containerRef]);

  return { dragSelectRect };
}
