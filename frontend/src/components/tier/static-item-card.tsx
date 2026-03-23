'use client';

import { hashColor } from '@/components/tier/item-card';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import type { TierItem } from '@/lib/store/tier-store';

/** DnD 없이 ItemCard와 동일한 타일 UI (읽기 전용·캡처용) */
export function StaticItemCard({ item }: { item: TierItem }) {
  const initials = item.name.slice(0, 2);
  const bgColor = hashColor(item.id);

  return (
    <div
      data-item-id={item.id}
      title={item.name}
      style={{
        backgroundColor: !item.imageUrl ? bgColor : undefined,
      }}
      className={[
        'relative w-16 h-16 flex items-center justify-center',
        'text-xs font-bold text-white rounded select-none',
        'border-2 border-transparent overflow-hidden',
      ].join(' ')}
    >
      {item.imageUrl ? (
        <img
          src={picktyImageDisplaySrc(item.imageUrl)}
          alt={item.name}
          className="w-full h-full object-cover pointer-events-none"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="text-center leading-tight px-0.5 drop-shadow pointer-events-none">
          {initials}
        </span>
      )}
    </div>
  );
}
