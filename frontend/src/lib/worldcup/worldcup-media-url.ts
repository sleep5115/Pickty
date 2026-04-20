/**
 * 월드컵 후보 미디어 URL 분류 — 플레이 화면에서 이미지 / 유튜브 iframe 등으로 분기할 때 사용.
 * 서버 페이로드는 기존과 같이 `imageUrl` 필드에 URL 문자열을 담는다.
 */

export type WorldCupMediaKind = 'empty' | 'image' | 'youtube' | 'unknown';

/** watch?v=, youtu.be/, shorts/, embed/ 등에서 비디오 ID 추출 */
export function parseYoutubeVideoId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return /^[\w-]{11}$/.test(id ?? '') ? id! : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      const i = parts.indexOf('embed');
      if (i >= 0 && parts[i + 1] && /^[\w-]{11}$/.test(parts[i + 1]!)) return parts[i + 1]!;
      const si = parts.indexOf('shorts');
      if (si >= 0 && parts[si + 1] && /^[\w-]{11}$/.test(parts[si + 1]!)) return parts[si + 1]!;
    }
  } catch {
    const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([\w-]{11})/);
    return m?.[1] ?? null;
  }
  return null;
}

export function getYoutubeThumbnailUrl(videoId: string, quality: 'hq' | 'mq' | 'sd' = 'mq'): string {
  const q = quality === 'hq' ? 'hqdefault' : quality === 'sd' ? 'sddefault' : 'mqdefault';
  return `https://img.youtube.com/vi/${videoId}/${q}.jpg`;
}

/** iframe embed 기본 경로 (쿼리 없음) */
export function getYoutubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * 월드컵 플레이 화면용 embed URL.
 * 자동재생·강제 음소거 없음 — 사용자가 재생 시 소리 재생 가능.
 * `controls=1`으로 유튜브 기본 컨트롤바 표시.
 */
export function buildWorldCupYoutubePlayEmbedSrc(videoId: string): string {
  const u = new URL(`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`);
  u.searchParams.set('controls', '1');
  u.searchParams.set('playsinline', '1');
  u.searchParams.set('rel', '0');
  u.searchParams.set('modestbranding', '1');
  return u.toString();
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i;

export function classifyWorldCupMediaUrl(raw: string): WorldCupMediaKind {
  const t = raw.trim();
  if (!t) return 'empty';
  if (parseYoutubeVideoId(t)) return 'youtube';
  if (IMAGE_EXT_RE.test(t)) return 'image';
  try {
    const u = new URL(t);
    if (/\.(discordapp|discord)\./i.test(u.hostname) && /attachments\//i.test(u.pathname)) return 'image';
  } catch {
    /* ignore */
  }
  return 'unknown';
}

/** 파일명에서 확장자 제거·경로 문자 정리 (업로드 행 이름 자동 완성용) */
export function stripUploadedImageBaseName(filename: string): string {
  const raw = filename?.trim();
  if (!raw) return '';
  const base = raw.replace(/\.[^.\\/]+$/i, '').replace(/[/\\]/g, '_');
  return base.slice(0, 100) || '이미지';
}

/** noembed / YouTube oEmbed — 영상 제목 (실패 시 null) */
export async function fetchYoutubeOembedTitle(videoPageUrl: string): Promise<string | null> {
  const u = videoPageUrl.trim();
  if (!u || !parseYoutubeVideoId(u)) return null;
  try {
    const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(u)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: unknown };
    const title = typeof j.title === 'string' ? j.title.trim() : '';
    return title ? title.slice(0, 200) : null;
  } catch {
    return null;
  }
}

/** 일괄 추가 시 표시 이름 후보 */
export function suggestItemNameFromUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return '항목';
  const vid = parseYoutubeVideoId(url);
  if (vid) return '유튜브';
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop();
    if (seg) {
      const base = decodeURIComponent(seg.split('?')[0] ?? seg);
      const short = base.replace(/\.[a-z0-9]+$/i, '').slice(0, 48);
      return short || '항목';
    }
    return u.hostname.replace(/^www\./, '').slice(0, 48) || '항목';
  } catch {
    return '항목';
  }
}

/** 붙여넣은 줄에서 URL 한 줄씩 분리 (빈 줄 제외) */
export function splitUrlLines(blob: string): string[] {
  return blob
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}
