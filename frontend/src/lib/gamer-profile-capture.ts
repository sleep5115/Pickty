import { toPng } from 'html-to-image';

/**
 * 신문 격자형 명함 카드 div 하나만 PNG로 캡처해 다운로드한다.
 * 프로필 이미지는 동일 출처(`/api/pickty-image?key=`)로 노출되므로 CORS 오염 없이 캡처된다.
 */
export async function downloadProfileCardPng(el: HTMLElement, slug: string): Promise<void> {
  const width = el.scrollWidth || 960;
  const height = el.scrollHeight || el.offsetHeight;

  const dataUrl = await toPng(el, {
    width,
    height,
    pixelRatio: 2,
    cacheBust: true,
    // `/api/pickty-image?key=A` 와 `?key=B` 가 동일 캐시키로 합쳐지지 않도록 쿼리 포함
    includeQueryParams: true,
    backgroundColor: '#0b0b12',
    // 인증자료 버튼 등 캡처 제외 표식 노드는 이미지에서 제거
    filter: (node) =>
      !(node instanceof Element && node.getAttribute('data-capture-ignore') === 'true'),
  });

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `pickty-profile-${slug}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
