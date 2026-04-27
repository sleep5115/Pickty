/**
 * Tiptap 등에서 나온 HTML이 빈 문서(`<p></p>` 등)인지 판별.
 * `trim()`만으로는 `<p></p>`가 걸러지지 않아 본문 미입력 검증에 사용한다.
 */
export function isCommunityBodyHtmlEffectivelyEmpty(html: string): boolean {
  const raw = html?.trim() ?? '';
  if (!raw) return true;
  if (typeof document === 'undefined') {
    const stripped = raw.replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ').trim();
    if (stripped.length > 0) return false;
    return !/<(img|iframe|video)\b/i.test(raw);
  }
  const el = document.createElement('div');
  el.innerHTML = raw;
  const text = (el.textContent ?? '').replace(/\u00a0|\u200b/g, ' ').trim();
  if (text.length > 0) return false;
  return el.querySelector('img, iframe, video') === null;
}
