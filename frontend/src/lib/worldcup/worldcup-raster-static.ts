/**
 * 목록·카드 썸네일에서 GIF가 계속 움직이지 않도록 할 때 사용.
 */

import { picktyImageCanvasFetchSrc, picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { getYoutubeThumbnailUrl, parseYoutubeVideoId } from '@/lib/worldcup/worldcup-media-url';

/** URL 문자열 기준으로 GIF 래스터 가능성 (Pickty `?key=…\.gif` 포함) */
export function isLikelyAnimatedGifRasterUrl(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s) return false;
  if (s.includes('.gif')) return true;
  return false;
}

/** Canvas 로드용 — R2는 `picktyImageDisplaySrc`, 그 외 절대 `http(s)`는 `/api/pickty-image?url=` 프록시 */
function rasterUrlForCanvasLoad(originalUrl: string): string {
  const t = originalUrl.trim();
  if (!t) throw new Error('freeze: URL이 비어 있습니다.');
  const vid = parseYoutubeVideoId(t);
  if (vid) {
    return picktyImageCanvasFetchSrc(getYoutubeThumbnailUrl(vid, 'mq'));
  }
  return picktyImageCanvasFetchSrc(picktyImageDisplaySrc(t));
}

/**
 * 원본(또는 이미 표시용) URL을 받아 **반드시** `picktyImageDisplaySrc` 경유 URL로 로드한 뒤 첫 프레임을 JPEG data URL로 고정.
 * `crossOrigin` 은 `src` 지정 전에 설정한다.
 */
export async function freezeRasterImageUrlToJpegDataUrl(
  originalOrDisplayUrl: string,
  maxEdge = 640,
): Promise<string> {
  const proxied = rasterUrlForCanvasLoad(originalOrDisplayUrl);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('freeze: 이미지를 불러오지 못했습니다.'));
    img.src = proxied;
  });
  await (typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve());

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (iw < 1 || ih < 1) {
    throw new Error('freeze: 유효한 이미지 크기가 아닙니다.');
  }
  const scale = Math.min(1, maxEdge / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('freeze: Canvas 2D를 사용할 수 없습니다.');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.9);
}
