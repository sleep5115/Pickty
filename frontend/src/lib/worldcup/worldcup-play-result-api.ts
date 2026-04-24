import { apiFetch } from '@/lib/api-fetch';

export async function submitWorldCupPlayResult(input: {
  templateId: string;
  winnerItemId: number;
  /** 세션에서 선택한 출전 강(2,4,8,16,…) — 서버가 단계별 진출 임계를 이에 맞춤 */
  startBracket: number;
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
      startBracket: input.startBracket,
      rows: input.rows,
    }),
  });
}
