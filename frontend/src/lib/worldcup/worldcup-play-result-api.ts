import { apiFetch } from '@/lib/api-fetch';

export async function submitWorldCupPlayResult(input: {
  templateId: string;
  winnerItemId: number;
  rows: Array<{
    itemId: number;
    peakBracketSize: number;
    winCount: number;
    matchCount: number;
    rerolledCount: number;
    droppedCount: number;
    keptBothCount: number;
  }>;
}) {
  return apiFetch(`/api/v1/worldcup/templates/${encodeURIComponent(input.templateId)}/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      winnerItemId: input.winnerItemId,
      rows: input.rows,
    }),
  });
}
