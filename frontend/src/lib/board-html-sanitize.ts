import DOMPurify from 'dompurify';

const BOARD_HTML_CONFIG: import('dompurify').Config = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ['iframe', 'figure', 'figcaption'],
  ADD_ATTR: [
    'allow',
    'allowfullscreen',
    'frameborder',
    'src',
    'title',
    'sandbox',
    'class',
    'style',
    'data-type',
    'width',
    'height',
    'loading',
    'referrerpolicy',
    'containerstyle',
    'alt',
  ],
};

/**
 * 브라우저에서 Tiptap `getHTML()` 결과를 소독할 때 사용.
 * SSR 단계에서는 호출되지 않는 것을 권장(`window` 없음 시 빈 문자열).
 */
export function sanitizeBoardHtml(dirty: string): string {
  if (typeof window === 'undefined') return '';
  if (!dirty || typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, BOARD_HTML_CONFIG);
}
