import { toPng } from 'html-to-image';

const DEFAULT_WIDTH = 800;

/**
 * 화면에서는 표배경이 ⚙·핸들 열을 덮지 않도록 `calc(100% - 4rem)` 이다.
 * PNG/썸네일용 클론에서는 크롬 노드를 제거한 뒤 표배경만 콘텐츠 너비에 맞게 전체 덮기.
 */
function prepareTierBoardCloneForImageCapture(clone: HTMLElement): void {
  clone.querySelectorAll('[data-capture-ignore="true"]').forEach((node) => {
    node.parentNode?.removeChild(node);
  });
  clone.querySelectorAll<HTMLElement>('[data-tier-board-surface]').forEach((el) => {
    el.style.width = '100%';
    el.style.inset = '0';
    el.style.left = '0';
    el.style.top = '0';
    el.style.right = '0';
    el.style.bottom = '0';
  });
}

/** 티어 라벨(S/A/B…)과 동일 계열 — `text-2xl font-black` */
function appendPicktyWatermark(root: HTMLElement): void {
  const computed = window.getComputedStyle(root);
  if (computed.position === 'static') {
    root.style.position = 'relative';
  }
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = [
    'position:absolute',
    'right:8px',
    'bottom:8px',
    'pointer-events:none',
    'z-index:10',
  ].join(';');
  const span = document.createElement('span');
  span.textContent = 'pickty.app';
  span.style.cssText = [
    'display:inline-block',
    'font-size:1.5rem',
    'line-height:1.1',
    'font-weight:900',
    'letter-spacing:-0.03em',
    'background:linear-gradient(100deg,#8b5cf6,#d946ef,#ec4899)',
    '-webkit-background-clip:text',
    'background-clip:text',
    'color:transparent',
    'filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45))',
  ].join(';');
  wrap.appendChild(span);
  root.appendChild(wrap);
}

export type CaptureTierPngOptions = {
  /** true일 때만 클론에 워터마크 삽입 (미리보기·썸네일용 캡처는 false) */
  includeWatermark?: boolean;
};

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
  options: CaptureTierPngOptions = {},
): Promise<string> {
  const { includeWatermark = false } = options;
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

  prepareTierBoardCloneForImageCapture(clone);

  if (includeWatermark) {
    appendPicktyWatermark(clone);
  }

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
      // 클론에서 `data-capture-ignore` 노드는 이미 제거됨 — 이중 방어
      filter: (node) =>
        !(node instanceof Element && node.getAttribute('data-capture-ignore') === 'true'),
    });
  } finally {
    document.body.removeChild(container);
  }
}
