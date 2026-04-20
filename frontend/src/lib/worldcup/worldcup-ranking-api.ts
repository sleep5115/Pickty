import { apiFetch } from '@/lib/api-fetch';

export interface WorldCupRankingRowDto {
  rank: number;
  itemId: string;
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

export function fetchWorldCupRanking(templateId: string) {
  return apiFetch(`/api/v1/worldcup/templates/${encodeURIComponent(templateId)}/ranking`);
}
