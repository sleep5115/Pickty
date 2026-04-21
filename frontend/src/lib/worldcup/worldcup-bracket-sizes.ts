/**
 * 강수 N강 = 이번 대진에 **N명이 출전**한다는 뜻이다.
 * 선택지는 `totalItems` 이하인 2의 제곱이면서 **16 이상**인 값만 포함한다 (16, 32, 64, …).
 * 예: 후보 20명 → [16] / 35명 → [16, 32] / 80명 → [16, 32, 64]. 나머지 후보는 리롤 풀로 간다.
 */
export function worldcupSelectableBracketSizes(totalItems: number): number[] {
  if (totalItems < 16) return [];
  const out: number[] = [];
  for (let n = 16; n <= totalItems; n *= 2) {
    out.push(n);
  }
  return out;
}

export function formatWorldCupRoundLabel(playerCount: number): string {
  if (playerCount <= 2) return '결승전';
  return `${playerCount}강`;
}
