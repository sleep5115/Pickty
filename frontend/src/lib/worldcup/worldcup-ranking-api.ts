import { apiFetch } from '@/lib/api-fetch';

export const WORLDCUP_RANKING_PAGE_SIZE = 20;

export interface WorldCupRankingRowDto {
  rank: number;
  itemId: number;
  matchCount: number;
  winCount: number;
  rerolledCount: number;
  droppedCount: number;
  keptBothCount: number;
  finalWinCount: number;
  winRatePct: number;
  championshipRatePct: number;
  skipRatePct: number;
  dropRatePct: number;
  nailBiterRatePct: number;
}

export interface WorldCupRankingPageDto {
  /** 집계 API가 내려주는 값. 구버전 백엔드면 0으로 두고 %만 표시 */
  totalCompletedPlays: number;
  content: WorldCupRankingRowDto[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function mapRankingRow(row: Record<string, unknown>): WorldCupRankingRowDto | null {
  if (!row || typeof row !== 'object') return null;
  const itemId = num(row.itemId ?? row.item_id);
  if (!Number.isFinite(itemId) || itemId <= 0) return null;
  return {
    rank: num(row.rank),
    itemId,
    matchCount: num(row.matchCount ?? row.match_count),
    winCount: num(row.winCount ?? row.win_count),
    rerolledCount: num(row.rerolledCount ?? row.rerolled_count),
    droppedCount: num(row.droppedCount ?? row.dropped_count),
    keptBothCount: num(row.keptBothCount ?? row.kept_both_count),
    finalWinCount: num(row.finalWinCount ?? row.final_win_count),
    winRatePct: num(row.winRatePct ?? row.win_rate_pct),
    championshipRatePct: num(row.championshipRatePct ?? row.championship_rate_pct),
    skipRatePct: num(row.skipRatePct ?? row.skip_rate_pct),
    dropRatePct: num(row.dropRatePct ?? row.drop_rate_pct),
    nailBiterRatePct: num(row.nailBiterRatePct ?? row.nail_biter_rate_pct),
  };
}

/**
 * 월드컵 템플릿 랭킹 페이지 (Spring Data `Page` JSON).
 * `page` 는 0부터.
 */
export async function fetchWorldCupRanking(
  templateId: string,
  page: number,
  size: number = WORLDCUP_RANKING_PAGE_SIZE,
  init?: RequestInit,
): Promise<WorldCupRankingPageDto> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  const res = await apiFetch(
    `/api/v1/worldcup/templates/${encodeURIComponent(templateId)}/ranking?${params.toString()}`,
    init ?? {},
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `랭킹을 불러오지 못했습니다 (${res.status})`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const rawContent = body.content;
  const content = Array.isArray(rawContent)
    ? rawContent
        .map((row) => (row && typeof row === 'object' ? mapRankingRow(row as Record<string, unknown>) : null))
        .filter((x): x is WorldCupRankingRowDto => x != null)
    : [];
  const totalCompletedPlays = num(
    body.totalCompletedPlays ?? body.total_completed_plays,
  );
  return {
    totalCompletedPlays: Number.isFinite(totalCompletedPlays) ? totalCompletedPlays : 0,
    content,
    totalElements: Number(body.totalElements ?? body.total_elements) || 0,
    totalPages: Number(body.totalPages ?? body.total_pages) || 0,
    size: Number(body.size) || size,
    number: Number(body.number) || page,
    first: Boolean(body.first),
    last: Boolean(body.last),
    empty: Boolean(body.empty),
  };
}
