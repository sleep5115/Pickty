import type { WorldCupItem, WorldCupLayoutMode } from '@/lib/store/worldcup-store';

function parseItemId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? Math.floor(n) : null;
  }
  return null;
}

/** 월드컵·티어 템플릿 `items` JSON — 최상단 배열 또는 레거시 `{ items: [...] }` */
export function parseWorldCupItemsPayload(items: Record<string, unknown> | unknown[] | null | undefined): WorldCupItem[] {
  if (items == null) return [];
  let raw: unknown = items;
  if (!Array.isArray(raw)) {
    if (typeof raw !== 'object') return [];
    const nested = (items as Record<string, unknown>).items;
    raw = nested ?? [];
  }
  if (!Array.isArray(raw)) return [];
  const out: WorldCupItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const id = parseItemId(o.id);
    if (id == null || id < 1) continue;
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
