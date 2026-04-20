import { apiFetch } from '@/lib/api-fetch';
import type { WorldCupItemStatsMap, WorldCupMatchHistory } from '@/lib/store/worldcup-store';

export async function submitWorldCupPlayResult(input: {
  templateId: string;
  winnerItemId: string;
  matchHistory: WorldCupMatchHistory;
  itemStats: WorldCupItemStatsMap;
}) {
  return apiFetch('/api/v1/worldcup/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: input.templateId,
      winnerItemId: input.winnerItemId,
      matchHistory: input.matchHistory,
      itemStats: input.itemStats,
    }),
  });
}
