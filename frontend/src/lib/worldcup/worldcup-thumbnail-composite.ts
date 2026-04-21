import { picktyImageCanvasFetchSrc, picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { getYoutubeThumbnailUrl, parseYoutubeVideoId } from '@/lib/worldcup/worldcup-media-url';

const BASE_W = 640;
const BASE_H = 400;
const CANVAS_DPR = 2;

/**
 * 합성용 — 원본 `imageUrl`만 받고, `crossOrigin='anonymous'` 후 `src`는 표시용 URL을 거친 뒤
 * 절대 `http(s)`는 `/api/pickty-image?url=` 로만 로드.
 */
function loadImageForCanvas(originalItemUrl: string, originalForError: string): Promise<HTMLImageElement> {
  const t = originalItemUrl.trim();
  if (!t) {
    return Promise.reject(new Error(`이미지를 불러오지 못했습니다: ${originalForError.slice(0, 80)}`));
  }
  const vid = parseYoutubeVideoId(t);
  const base = vid ? getYoutubeThumbnailUrl(vid, 'mq') : picktyImageDisplaySrc(t);
  const src = picktyImageCanvasFetchSrc(base);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
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

/**
 * GIF 등에서 목적지 좌표가 어긋해 보이는 경우를 막기 위해, 목적지 직사각형에 **하드 클립** 후 cover 그리기.
 */
function drawImageCoverClippedToRect(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  clipX: number,
  clipY: number,
  clipW: number,
  clipH: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(clipX, clipY, clipW, clipH);
  ctx.clip();
  drawImageCover(ctx, img, clipX, clipY, clipW, clipH);
  ctx.restore();
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
  if (!u0) {
    throw new Error('썸네일 자동 합성을 위해 최소 한 개의 미디어 URL이 필요합니다.');
  }
  const rightRaw = u1 || u0;

  const W = BASE_W * CANVAS_DPR;
  const H = BASE_H * CANVAS_DPR;
  const half = Math.floor(W / 2);
  const rightW = W - half;

  const [imgL, imgR] = await Promise.all([
    loadImageForCanvas(u0, u0),
    loadImageForCanvas(rightRaw, rightRaw),
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

  drawImageCoverClippedToRect(ctx, imgL, 0, 0, half, H);
  drawImageCoverClippedToRect(ctx, imgR, half, 0, rightW, H);

  return canvasToPngBlob(canvas);
}
