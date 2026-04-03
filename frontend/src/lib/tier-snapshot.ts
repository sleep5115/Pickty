import type { TemplateBoardSurface } from '@/lib/template-board-config';
import {
  resolvePicktyUploadsUrl,
  rewriteTierItemsUploadUrls,
  rewriteTiersUploadUrls,
} from '@/lib/pickty-image-url';
import { isTierSpacerId } from '@/lib/tier-spacer-id';
import type { Tier, TierItem } from '@/lib/store/tier-store';

/** 프론트 ↔ 백 스냅샷 스키마 (버전 올리면 마이그레이션) */
export const TIER_SNAPSHOT_SCHEMA_VERSION = 1;

export interface TierSnapshotPayload {
  schemaVersion: typeof TIER_SNAPSHOT_SCHEMA_VERSION;
  tiers: Tier[];
  pool: TierItem[];
  /** `/tier` 표 전체 배경(색·이미지) — 구 스냅샷에는 없음 */
  workspaceBoardSurface?: TemplateBoardSurface | null;
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

export function buildTierSnapshot(
  tiers: Tier[],
  pool: TierItem[],
  workspaceBoardSurface?: TemplateBoardSurface | null,
): TierSnapshotPayload {
  const board = normalizeWorkspaceBoardSurfaceForSnapshot(workspaceBoardSurface);
  return {
    schemaVersion: TIER_SNAPSHOT_SCHEMA_VERSION,
    tiers,
    pool,
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

/** DB에 박힌 예전 업로드 호스트(ngrok 등)를 현재 `NEXT_PUBLIC_API_URL`에 맞춤 */
export function rewriteSnapshotUploadedImageUrls(data: Record<string, unknown>): Record<string, unknown> {
  if (data.schemaVersion !== 1) return data;
  const tiers = data.tiers;
  const pool = data.pool;
  if (!Array.isArray(tiers) || !Array.isArray(pool)) return data;

  const out: Record<string, unknown> = {
    ...data,
    tiers: rewriteTiersUploadUrls(tiers as Tier[]),
    pool: rewriteTierItemsUploadUrls(pool as TierItem[]),
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

/** API `snapshotData` → 보드 복원용 (리믹스·읽기 전용과 동일 스키마) */
export function parseSnapshotDataToBoard(
  data: Record<string, unknown>,
): {
  tiers: Tier[];
  pool: TierItem[];
  workspaceBoardSurface: TemplateBoardSurface | null;
} | null {
  const normalized = rewriteSnapshotUploadedImageUrls(data);
  if (normalized.schemaVersion !== 1) return null;
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
