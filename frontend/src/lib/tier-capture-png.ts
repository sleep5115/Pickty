import { toPng } from 'html-to-image';

const DEFAULT_WIDTH = 800;

export function formatImageCaptureError(err: unknown): string {
  if (err instanceof Error) return err.message || err.name || 'Error';
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.name === 'string') return o.name;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * 티어 보드 DOM을 PNG 데이터 URL로 변환 (html-to-image).
 * 교차 출처 이미지는 서버 CORS + img crossOrigin="anonymous" 필요.
 */
export async function captureTierElementToPng(
  el: HTMLElement,
  width: number = DEFAULT_WIDTH,
): Promise<string> {
  const container = document.createElement('div');
  container.style.cssText = [
    'position: fixed',
    'top: 100vh',
    'left: 0',
    `width: ${width}px`,
    'pointer-events: none',
    'z-index: -1',
  ].join('; ');
  document.body.appendChild(container);

  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.width = `${width}px`;
  clone.style.minWidth = `${width}px`;
  clone.style.overflow = 'visible';
  container.appendChild(clone);

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  try {
    const captureHeight = clone.scrollHeight || el.scrollHeight;
    return await toPng(clone, {
      width,
      height: captureHeight,
      // html-to-image 기본 캐시 키가 쿼리를 제거함 → `/api/pickty-image?key=A` 와 `?key=B` 가 동일 키로
      // 합쳐져 첫 이미지만 모든 타일에 재사용되는 버그 방지
      includeQueryParams: true,
      style: {
        overflow: 'visible',
        width: `${width}px`,
        minWidth: `${width}px`,
        height: `${captureHeight}px`,
      },
      filter: (node) => {
        if (node instanceof Element && node.getAttribute('data-capture-ignore') === 'true') {
          return false;
        }
        return true;
      },
    });
  } finally {
    document.body.removeChild(container);
  }
}
