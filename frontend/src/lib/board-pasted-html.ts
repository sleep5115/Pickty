/**
 * 웹에서 복사한 `<a href="..."><img ...></a>` 가 Typography·imageResize와 겹침을 일으킬 때,
 * 단일 이미지만 감싼 링크 껍데기를 벗겨 `<img>`만 남긴다.
 */
export function unwrapAnchorAroundSingleImageInHtml(html: string): string {
  if (typeof window === 'undefined' || !html.includes('<')) {
    return html;
  }
  try {
    const doc = new DOMParser().parseFromString(`<div id="__p">${html}</div>`, 'text/html');
    const root = doc.getElementById('__p');
    if (!root) return html;

    const anchors = root.querySelectorAll('a');
    anchors.forEach((a) => {
      const nonEmpty = Array.from(a.childNodes).filter((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          return (n.textContent?.replace(/\u00a0/g, ' ').trim() ?? '') !== '';
        }
        return true;
      });
      if (nonEmpty.length !== 1) return;
      const only = nonEmpty[0]!;
      if (only.nodeType !== Node.ELEMENT_NODE) return;
      const el = only as Element;
      if (el.tagName !== 'IMG') return;
      a.replaceWith(el.cloneNode(true));
    });

    return root.innerHTML;
  } catch {
    return html;
  }
}
