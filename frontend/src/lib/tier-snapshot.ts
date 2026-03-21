import { rewriteTierItemsUploadUrls, rewriteTiersUploadUrls } from '@/lib/pickty-image-url';
import type { Tier, TierItem } from '@/lib/store/tier-store';

/** 프론트 ↔ 백 스냅샷 스키마 (버전 올리면 마이그레이션) */
export const TIER_SNAPSHOT_SCHEMA_VERSION = 1;

export interface TierSnapshotPayload {
  schemaVersion: typeof TIER_SNAPSHOT_SCHEMA_VERSION;
  tiers: Tier[];
  pool: TierItem[];
}

export function buildTierSnapshot(tiers: Tier[], pool: TierItem[]): TierSnapshotPayload {
  return {
    schemaVersion: TIER_SNAPSHOT_SCHEMA_VERSION,
    tiers,
    pool,
  };
}

/** 템플릿 items JSON용 — 보드에 등장한 아이템 중복 제거 */
export function collectDistinctItems(tiers: Tier[], pool: TierItem[]): TierItem[] {
  const map = new Map<string, TierItem>();
  for (const row of tiers) {
    for (const item of row.items) map.set(item.id, item);
  }
  for (const item of pool) map.set(item.id, item);
  return [...map.values()];
}

/** DB에 박힌 예전 업로드 호스트(ngrok 등)를 현재 `NEXT_PUBLIC_API_URL`에 맞춤 */
export function rewriteSnapshotUploadedImageUrls(data: Record<string, unknown>): Record<string, unknown> {
  if (data.schemaVersion !== 1) return data;
  const tiers = data.tiers;
  const pool = data.pool;
  if (!Array.isArray(tiers) || !Array.isArray(pool)) return data;
  return {
    ...data,
    tiers: rewriteTiersUploadUrls(tiers as Tier[]),
    pool: rewriteTierItemsUploadUrls(pool as TierItem[]),
  };
}
