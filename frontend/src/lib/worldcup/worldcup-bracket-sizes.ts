/**
 * 강수 N강 = 이번 대진에 **N명이 출전**한다는 뜻이다.
 * 선택지는 `totalItems` 이하인 2의 거듭제곱 (2, 4, 8, 16, …).
 * 예: 후보 2명 → [2] / 20명 → [2, 4, 8, 16] / 35명 → [2, 4, 8, 16, 32]. 나머지 후보는 리롤 풀로 간다.
 */
export function worldcupSelectableBracketSizes(totalItems: number): number[] {
  if (totalItems < 2) return [];
  const out: number[] = [];
  for (let n = 2; n <= totalItems; n *= 2) {
    out.push(n);
  }
  return out;
}

export function formatWorldCupRoundLabel(playerCount: number): string {
  if (playerCount <= 2) return '2강(결승전)';
  return `${playerCount}강`;
}
