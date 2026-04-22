import type { WorldCupItem, WorldCupLayoutMode } from '@/lib/store/worldcup-store';

/** `tier_templates` / 월드컵 템플릿 `items` JSON — `items: [{ id, name, imageUrl? }, ...]` */
export function parseWorldCupItemsPayload(items: Record<string, unknown> | null | undefined): WorldCupItem[] {
  if (items == null || typeof items !== 'object') return [];
  const raw = items.items;
  if (!Array.isArray(raw)) return [];
  const out: WorldCupItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : o.id != null ? String(o.id) : '';
    if (!id) continue;
    const name = typeof o.name === 'string' ? o.name : '';
    const imageUrl = typeof o.imageUrl === 'string' ? o.imageUrl : undefined;
    out.push({ id, name, imageUrl });
  }
  return out;
}

export function parseWorldCupLayoutMode(raw: string): WorldCupLayoutMode {
  if (raw === 'split_diagonal' || raw === 'split_lr') return raw;
  return 'split_lr';
}
