import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { getYoutubeThumbnailUrl, parseYoutubeVideoId } from '@/lib/worldcup/worldcup-media-url';

const BASE_W = 640;
const BASE_H = 400;
const CANVAS_DPR = 2;

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

/** object-fit: cover — 영역을 채우고 넘치는 부분은 잘라냄 */
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
  const scale = Math.max(dWidth / iw, dHeight / ih);
  const sw = dWidth / scale;
  const sh = dHeight / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dWidth, dHeight);
}

function resolveCompositeRasterSrc(raw: string): string {
  const t = raw.trim();
  if (!t) throw new Error('썸네일 합성용 미디어 URL이 비어 있습니다.');
  const vid = parseYoutubeVideoId(t);
  if (vid) return getYoutubeThumbnailUrl(vid, 'mq');
  return picktyImageDisplaySrc(t);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('썸네일 PNG 변환에 실패했습니다.'));
    }, 'image/png');
  });
}

export type WorldCupCompositeItemInput = { imageUrl?: string | null };

/**
 * 월드컵 허브 카드용 좌우 50:50 합성 썸네일 (16:10).
 * `items[0]`·`items[1]` 미디어를 사용하고, 부족하면 앞쪽 URL을 반복합니다.
 */
export async function createWorldCupCompositeThumbnail(
  items: readonly WorldCupCompositeItemInput[],
): Promise<Blob> {
  const u0 = items[0]?.imageUrl?.trim() ?? '';
  const u1 = items[1]?.imageUrl?.trim() ?? '';
  const leftSrc = u0 ? resolveCompositeRasterSrc(u0) : '';
  const rightSrc = u1 ? resolveCompositeRasterSrc(u1) : leftSrc;
  if (!leftSrc) {
    throw new Error('썸네일 자동 합성을 위해 최소 한 개의 미디어 URL이 필요합니다.');
  }
  const finalRight = rightSrc || leftSrc;

  const W = BASE_W * CANVAS_DPR;
  const H = BASE_H * CANVAS_DPR;
  const half = W / 2;

  const [imgL, imgR] = await Promise.all([
    loadImageForCanvas(leftSrc, u0 || leftSrc),
    loadImageForCanvas(finalRight, u1 || u0 || finalRight),
  ]);

  await Promise.all(
    [imgL, imgR].map((img) =>
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

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, W, H);

  drawImageCover(ctx, imgL, 0, 0, half, H);
  drawImageCover(ctx, imgR, half, 0, half, H);

  return canvasToPngBlob(canvas);
}
