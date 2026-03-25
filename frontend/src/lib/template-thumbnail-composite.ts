import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';

const GRID_SIZE_PX = 512;
const GRID_GAP_PX = 2;
/** 업로드 전 선명도 — 최종은 WebP 압축에서 줄어듦 */
const CANVAS_DPR = 2;

const BG_HEX = '#e2e8f0';
const CELL_HEX = '#f1f5f9';

function loadImageForCanvas(src: string, originalForError: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const needsCors =
      src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//');
    if (needsCors) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`이미지를 불러오지 못했습니다: ${originalForError.slice(0, 80)}`));
    img.src = src;
  });
}

/** object-fit: cover — 셀 중앙 기준 크롭 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number,
): void {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (iw < 1 || ih < 1) return;
  const r = Math.max(dWidth / iw, dHeight / ih);
  const sw = dWidth / r;
  const sh = dHeight / r;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dWidth, dHeight);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('썸네일 PNG 변환에 실패했습니다.'));
    }, 'image/png');
  });
}

/**
 * 2×2 그리드를 Canvas에 직접 그려 PNG Blob 생성 (템플릿 목록용 단일 썸네일).
 * DOM 스냅샷(html-to-image)은 뷰포트 밖·opacity·transform에 취약해 빈/찌그러진 결과가 나와
 * 이 경로는 브라우저 drawImage만 사용한다.
 *
 * Pickty R2 URL은 `picktyImageDisplaySrc`로 `/api/pickty-image?key=` 동일 출처 로드.
 */
export async function captureTemplateThumbnail2x2(imageUrls: readonly string[]): Promise<Blob> {
  if (imageUrls.length !== 4) {
    throw new Error('썸네일 자동 합성에는 아이템 이미지 URL이 정확히 4개 필요합니다.');
  }

  const displaySrcs = imageUrls.map((u) => picktyImageDisplaySrc(u.trim()));

  const W = GRID_SIZE_PX * CANVAS_DPR;
  const H = GRID_SIZE_PX * CANVAS_DPR;
  const gap = GRID_GAP_PX * CANVAS_DPR;
  const cell = (W - gap) / 2;

  const corners: [number, number][] = [
    [0, 0],
    [cell + gap, 0],
    [0, cell + gap],
    [cell + gap, cell + gap],
  ];

  const imgs = await Promise.all(
    displaySrcs.map((src, i) => loadImageForCanvas(src, imageUrls[i]!.trim())),
  );

  for (const img of imgs) {
    if (img.naturalWidth < 1 || img.naturalHeight < 1) {
      throw new Error('썸네일 합성용 이미지 크기가 0입니다.');
    }
  }
  await Promise.all(
    imgs.map((img) =>
      typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve(),
    ),
  );

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D 컨텍스트를 사용할 수 없습니다.');
  }

  ctx.fillStyle = BG_HEX;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 4; i++) {
    const [x, y] = corners[i]!;
    ctx.fillStyle = CELL_HEX;
    ctx.fillRect(x, y, cell, cell);
    drawImageCover(ctx, imgs[i]!, x, y, cell, cell);
  }

  return canvasToPngBlob(canvas);
}
