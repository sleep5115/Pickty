/** 레이아웃용 투명 블록 ID — 스토어·dnd-kit과 분리해 RSC/서버에서도 안전하게 import 가능 */
export function isTierSpacerId(id: string): boolean {
  return id.startsWith('spacer-');
}
