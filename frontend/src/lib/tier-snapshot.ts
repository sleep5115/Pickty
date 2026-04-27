import type { TemplateBoardSurface } from '@/lib/template-board-config';
import {
  resolvePicktyUploadsUrl,
  rewriteTierItemsUploadUrls,
  rewriteTiersUploadUrls,
} from '@/lib/pickty-image-url';
import { isTierSpacerId, newTierSpacerId } from '@/lib/tier-spacer-id';
import type { Tier, TierItem } from '@/lib/store/tier-store';

/** 프론트 ↔ 백 스냅샷 스키마 (버전 올리면 마이그레이션) — v2: 풀·티어 행은 숫자 id만 저장 */
export const TIER_SNAPSHOT_SCHEMA_VERSION = 2;

/** v2 `tiers[].items`·`pool`에서 레이아웃용 투명 블록 자리 — DB 템플릿 PK와 겹치지 않게 음수 사용 */
export const TIER_SNAPSHOT_SPACER_SENTINEL = -1;

/** v1 레거시(풀·티어에 전체 TierItem 객체 embed) */
const TIER_SNAPSHOT_SCHEMA_VERSION_LEGACY = 1;

export interface TierSnapshotRowStored {
  id: string;
  label: string;
  color: string;
  textColor?: string;
  paintLabelColorUnderImage?: boolean;
  showLabelColor?: boolean;
  backgroundUrl?: string;
  /** 템플릿 아이템 PK — JSON 숫자로 저장. `TIER_SNAPSHOT_SPACER_SENTINEL`이면 투명 블록 자리 */
  items: number[];
}

export interface TierSnapshotPayloadV2 {
  schemaVersion: typeof TIER_SNAPSHOT_SCHEMA_VERSION;
  tiers: TierSnapshotRowStored[];
  pool: number[];
  /** `/tier` 표 전체 배경(색·이미지) — 구 스냅샷에는 없음 */
  workspaceBoardSurface?: TemplateBoardSurface | null;
}

export type TierSnapshotPayload = TierSnapshotPayloadV2;

function snapshotSchemaVersion(data: Record<string, unknown>): number {
  const v = data.schemaVersion;
  if (v === undefined || v === null) return TIER_SNAPSHOT_SCHEMA_VERSION_LEGACY;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : TIER_SNAPSHOT_SCHEMA_VERSION_LEGACY;
}

/** v2 스냅샷은 `tier_templates` 아이템으로 id→메타 조인이 필요 */
export function snapshotRequiresTemplateCatalog(data: Record<string, unknown>): boolean {
  return snapshotSchemaVersion(data) === TIER_SNAPSHOT_SCHEMA_VERSION;
}

function normalizeWorkspaceBoardSurfaceForSnapshot(
  surface: TemplateBoardSurface | null | undefined,
): TemplateBoardSurface | null {
  if (!surface) return null;
  const bc = surface.backgroundColor?.trim();
  const bu = surface.backgroundUrl?.trim();
  if (!bc && !bu) return null;
  return {
    ...(bc ? { backgroundColor: bc } : {}),
    ...(bu ? { backgroundUrl: bu } : {}),
  };
}

function coerceTemplateItemNumericId(
  item: TierItem,
  itemIdRemap?: ReadonlyMap<string, number>,
): number | null {
  if (isTierSpacerId(item.id)) return TIER_SNAPSHOT_SPACER_SENTINEL;
  if (itemIdRemap?.has(item.id)) return itemIdRemap.get(item.id)!;
  const n = Number(item.id);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

export function buildTierSnapshot(
  tiers: Tier[],
  pool: TierItem[],
  workspaceBoardSurface?: TemplateBoardSurface | null,
  itemIdRemap?: ReadonlyMap<string, number>,
): TierSnapshotPayloadV2 {
  const board = normalizeWorkspaceBoardSurfaceForSnapshot(workspaceBoardSurface);
  const tiersOut: TierSnapshotRowStored[] = tiers.map((t) => {
    const row: TierSnapshotRowStored = {
      id: t.id,
      label: t.label,
      color: t.color,
      items: t.items
        .map((it) => coerceTemplateItemNumericId(it, itemIdRemap))
        .filter((x): x is number => x != null),
    };
    if (t.textColor !== undefined) row.textColor = t.textColor;
    if (t.paintLabelColorUnderImage !== undefined) row.paintLabelColorUnderImage = t.paintLabelColorUnderImage;
    if (t.showLabelColor !== undefined) row.showLabelColor = t.showLabelColor;
    const bg = t.backgroundUrl?.trim();
    if (bg) row.backgroundUrl = bg;
    return row;
  });
  const poolOut = pool
    .map((it) => coerceTemplateItemNumericId(it, itemIdRemap))
    .filter((x): x is number => x != null);

  return {
    schemaVersion: TIER_SNAPSHOT_SCHEMA_VERSION,
    tiers: tiersOut,
    pool: poolOut,
    ...(board ? { workspaceBoardSurface: board } : {}),
  };
}

/**
 * 템플릿 생성 API `items`·통계용 — 실제 이미지 아이템만 (`spacer-` 레이아웃 블록 제외).
 * PNG 썸네일·보드 캡처는 DOM에서 스페이서 타일이 폭을 유지하며, 이 함수와 무관함.
 */
export function collectDistinctItems(tiers: Tier[], pool: TierItem[]): TierItem[] {
  const map = new Map<string, TierItem>();
  for (const row of tiers) {
    for (const item of row.items) {
      if (!isTierSpacerId(item.id)) map.set(item.id, item);
    }
  }
  for (const item of pool) {
    if (!isTierSpacerId(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

function parseWorkspaceBoardSurfaceFromSnapshot(raw: unknown): TemplateBoardSurface | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const bc = typeof o.backgroundColor === 'string' ? o.backgroundColor.trim() : '';
  const bu = typeof o.backgroundUrl === 'string' ? o.backgroundUrl.trim() : '';
  if (!bc && !bu) return null;
  return {
    ...(bc ? { backgroundColor: bc } : {}),
    ...(bu ? { backgroundUrl: bu } : {}),
  };
}

/** 스냅샷 배열 원소에서 숫자 id만 추출 — `[1,2]` · `[{id:1}]` 모두 허용 */
export function parseNumericIdsFromSnapshotArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const x of raw) {
    if (typeof x === 'number' && Number.isFinite(x)) {
      out.push(Math.floor(x));
      continue;
    }
    if (x && typeof x === 'object' && 'id' in x) {
      const n = Number((x as { id: unknown }).id);
      if (Number.isFinite(n)) out.push(Math.floor(n));
    }
  }
  return out;
}

function buildTierItemCatalog(templateItems: TierItem[]): Map<number, TierItem> {
  const m = new Map<number, TierItem>();
  for (const it of templateItems) {
    if (isTierSpacerId(it.id)) continue;
    const n = Number(it.id);
    if (!Number.isFinite(n)) continue;
    const key = Math.floor(n);
    m.set(key, { ...it, id: String(key) });
  }
  return m;
}

function hydrateIdsFromCatalog(ids: readonly number[], catalog: Map<number, TierItem>): TierItem[] {
  return ids.map((nid) => {
    if (nid === TIER_SNAPSHOT_SPACER_SENTINEL) {
      return { id: newTierSpacerId(), name: '투명 블록' };
    }
    const hit = catalog.get(nid);
    if (hit) return { ...hit };
    return { id: String(nid), name: '삭제된 항목' };
  });
}

/** DB에 박힌 예전 업로드 호스트(ngrok 등)를 현재 `NEXT_PUBLIC_API_URL`에 맞춤 */
export function rewriteSnapshotUploadedImageUrls(data: Record<string, unknown>): Record<string, unknown> {
  const sv = snapshotSchemaVersion(data);
  if (sv === TIER_SNAPSHOT_SCHEMA_VERSION_LEGACY) {
    if (!Array.isArray(data.tiers) || !Array.isArray(data.pool)) return data;

    const out: Record<string, unknown> = {
      ...data,
      tiers: rewriteTiersUploadUrls(data.tiers as Tier[]),
      pool: rewriteTierItemsUploadUrls(data.pool as TierItem[]),
    };

    if ('workspaceBoardSurface' in data) {
      const parsed = parseWorkspaceBoardSurfaceFromSnapshot(data.workspaceBoardSurface);
      if (parsed?.backgroundUrl?.trim()) {
        const resolved = resolvePicktyUploadsUrl(parsed.backgroundUrl.trim());
        out.workspaceBoardSurface =
          resolved === parsed.backgroundUrl ? parsed : { ...parsed, backgroundUrl: resolved };
      } else if (parsed) {
        out.workspaceBoardSurface = parsed;
      } else {
        delete out.workspaceBoardSurface;
      }
    }

    return out;
  }

  if (sv === TIER_SNAPSHOT_SCHEMA_VERSION) {
    const tiers = data.tiers;
    if (!Array.isArray(tiers)) return data;
    const nextTiers = tiers.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const t = row as Record<string, unknown>;
      const rawBg = typeof t.backgroundUrl === 'string' ? t.backgroundUrl.trim() : '';
      let backgroundUrl = t.backgroundUrl;
      if (rawBg) {
        const resolved = resolvePicktyUploadsUrl(rawBg);
        if (resolved !== rawBg) backgroundUrl = resolved;
      }
      return backgroundUrl !== t.backgroundUrl ? { ...t, backgroundUrl } : t;
    });

    const out: Record<string, unknown> = {
      ...data,
      tiers: nextTiers,
    };

    if ('workspaceBoardSurface' in data) {
      const parsed = parseWorkspaceBoardSurfaceFromSnapshot(data.workspaceBoardSurface);
      if (parsed?.backgroundUrl?.trim()) {
        const resolved = resolvePicktyUploadsUrl(parsed.backgroundUrl.trim());
        out.workspaceBoardSurface =
          resolved === parsed.backgroundUrl ? parsed : { ...parsed, backgroundUrl: resolved };
      } else if (parsed) {
        out.workspaceBoardSurface = parsed;
      } else {
        delete out.workspaceBoardSurface;
      }
    }

    return out;
  }

  return data;
}

function parseSnapshotV1Board(normalized: Record<string, unknown>): {
  tiers: Tier[];
  pool: TierItem[];
  workspaceBoardSurface: TemplateBoardSurface | null;
} | null {
  const tiers = normalized.tiers;
  const pool = normalized.pool;
  if (!Array.isArray(tiers) || !Array.isArray(pool)) return null;
  const workspaceBoardSurface = parseWorkspaceBoardSurfaceFromSnapshot(
    normalized.workspaceBoardSurface,
  );
  return {
    tiers: tiers as Tier[],
    pool: pool as TierItem[],
    workspaceBoardSurface,
  };
}

function parseTierRowMetadataV2(raw: Record<string, unknown>): Omit<Tier, 'items'> | null {
  const id =
    typeof raw.id === 'string' ? raw.id : typeof raw.id === 'number' ? String(Math.floor(raw.id)) : '';
  if (!id) return null;
  const label = typeof raw.label === 'string' ? raw.label : '';
  const color = typeof raw.color === 'string' ? raw.color : '#cccccc';
  const row: Omit<Tier, 'items'> = {
    id,
    label,
    color,
  };
  if (typeof raw.textColor === 'string') row.textColor = raw.textColor;
  if (typeof raw.paintLabelColorUnderImage === 'boolean') row.paintLabelColorUnderImage = raw.paintLabelColorUnderImage;
  if (typeof raw.showLabelColor === 'boolean') row.showLabelColor = raw.showLabelColor;
  const bu = typeof raw.backgroundUrl === 'string' ? raw.backgroundUrl.trim() : '';
  if (bu) row.backgroundUrl = bu;
  return row;
}

function parseSnapshotV2Board(
  normalized: Record<string, unknown>,
  templateItems: TierItem[],
): {
  tiers: Tier[];
  pool: TierItem[];
  workspaceBoardSurface: TemplateBoardSurface | null;
} | null {
  const tiersRaw = normalized.tiers;
  const poolRaw = normalized.pool;
  if (!Array.isArray(tiersRaw) || !Array.isArray(poolRaw)) return null;

  const catalog = buildTierItemCatalog(templateItems);
  const workspaceBoardSurface = parseWorkspaceBoardSurfaceFromSnapshot(
    normalized.workspaceBoardSurface,
  );

  const tiers: Tier[] = [];
  for (const tr of tiersRaw) {
    if (!tr || typeof tr !== 'object') continue;
    const meta = parseTierRowMetadataV2(tr as Record<string, unknown>);
    if (!meta) continue;
    const ids = parseNumericIdsFromSnapshotArray((tr as Record<string, unknown>).items);
    tiers.push({
      ...meta,
      items: hydrateIdsFromCatalog(ids, catalog),
    });
  }

  const poolIds = parseNumericIdsFromSnapshotArray(poolRaw);
  const pool = hydrateIdsFromCatalog(poolIds, catalog);

  return { tiers, pool, workspaceBoardSurface };
}

/**
 * API `snapshotData` → 보드 복원용 (리믹스·읽기 전용과 동일 스키마).
 * 스키마 v2는 `tier_templates.items`에서 id→name/imageUrl 조인에 `templateItems` 필요.
 */
export function parseSnapshotDataToBoard(
  data: Record<string, unknown>,
  templateItems?: TierItem[] | null,
): {
  tiers: Tier[];
  pool: TierItem[];
  workspaceBoardSurface: TemplateBoardSurface | null;
} | null {
  const normalized = rewriteSnapshotUploadedImageUrls(data);
  const sv = snapshotSchemaVersion(normalized);

  if (sv === TIER_SNAPSHOT_SCHEMA_VERSION_LEGACY) {
    return parseSnapshotV1Board(normalized);
  }

  if (sv === TIER_SNAPSHOT_SCHEMA_VERSION) {
    return parseSnapshotV2Board(normalized, templateItems ?? []);
  }

  return null;
}
