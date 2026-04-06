import type { Node as PMNode } from '@tiptap/pm/model';

export const BOARD_EDITOR_MAX_CHARACTERS = 10_000;
export const BOARD_EDITOR_MAX_IMAGES = 50;

export function countImageResizeNodes(root: PMNode): number {
  let n = 0;
  root.descendants((node) => {
    if (node.type.name === 'imageResize') n += 1;
  });
  return n;
}

/**
 * 붙여넣기 클립보드에서 이미지 파일만 수집.
 * `DataTransferItemList` 기준으로 `kind === 'file'` 이고 `type`이 `image/`로 시작하는 항목만 `getAsFile()`로 모은 뒤,
 * 비어 있으면 `clipboardData.files`를 동일 조건으로 폴백한다.
 */
export function collectImageFilesFromClipboard(event: ClipboardEvent): File[] {
  const dt = event.clipboardData;
  if (!dt) return [];

  const items = Array.from(dt.items ?? []);
  const fromItems: File[] = [];
  for (const item of items) {
    if (item.kind !== 'file') continue;
    if (!item.type.startsWith('image/')) continue;
    const f = item.getAsFile();
    if (f) fromItems.push(f);
  }
  if (fromItems.length > 0) {
    return fromItems;
  }

  if (!dt.files?.length) return [];
  return Array.from(dt.files).filter((f) => f.type.startsWith('image/'));
}

export function collectImageFilesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt?.files?.length) return [];
  return Array.from(dt.files).filter((f) => f.type.startsWith('image/'));
}
