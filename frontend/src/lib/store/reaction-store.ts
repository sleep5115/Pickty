import type { CommunityReactionType } from '@/lib/api/community-api';

const STORAGE_KEY = 'pickty.community.reactions.v1';

/** `targetId`(UUID) → 마지막으로 누른 반응 — 템플릿·결과 id 충돌 없음 */
type StoredMap = Record<string, string>;

function readMap(): StoredMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return { ...(parsed as StoredMap) };
  } catch {
    return {};
  }
}

function writeMap(map: StoredMap): void {
  if (typeof window === 'undefined') return;
  try {
    if (Object.keys(map).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

function isReactionType(v: string): v is CommunityReactionType {
  return v === 'LIKE' || v === 'UPVOTE' || v === 'DOWNVOTE';
}

export function getStoredReaction(targetId: string): CommunityReactionType | null {
  if (!targetId) return null;
  const v = readMap()[targetId];
  if (typeof v !== 'string' || !isReactionType(v)) return null;
  return v;
}

export function setStoredReaction(targetId: string, reaction: CommunityReactionType | null): void {
  if (!targetId) return;
  const map = readMap();
  if (reaction == null) {
    delete map[targetId];
  } else {
    map[targetId] = reaction;
  }
  writeMap(map);
}
