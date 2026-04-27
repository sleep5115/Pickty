/** 레이아웃용 투명 블록 ID — 스토어·dnd-kit과 분리해 RSC/서버에서도 안전하게 import 가능 */
export function isTierSpacerId(id: string): boolean {
  return id.startsWith('spacer-');
}

/** 새 투명 블록 — `tier-store`·스냅샷 복원 등 공통 */
export function newTierSpacerId(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function') {
      return `spacer-${c.randomUUID()}`;
    }
  } catch {
    // Secure Context가 아닐 때 randomUUID 사용 불가
  }
  return `spacer-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
