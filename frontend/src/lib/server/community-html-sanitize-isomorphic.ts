import 'server-only';

import DOMPurify from 'isomorphic-dompurify';

const BOARD_HTML_CONFIG: import('dompurify').Config = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ['iframe', 'details', 'summary', 'figure', 'figcaption'],
  ADD_ATTR: [
    'allow',
    'allowfullscreen',
    'frameborder',
    'src',
    'title',
    'sandbox',
    'class',
    'style',
    'open',
    'data-type',
    'data-pickty-link-card',
    'data-href',
    'data-title',
    'data-image',
    'data-kind',
    'data-twitter-embed',
    'data-tweet-id',
    'width',
    'height',
    'loading',
    'referrerpolicy',
    'containerstyle',
    'alt',
  ],
};

/** API·RSC 등 서버에서 저장 HTML을 소독할 때만 사용. 클라이언트에서 import 금지. */
export function sanitizeBoardHtmlOnServer(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return '';
  return DOMPurify.sanitize(dirty, BOARD_HTML_CONFIG);
}
