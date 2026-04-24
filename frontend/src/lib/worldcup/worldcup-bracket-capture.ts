import { toPng } from 'html-to-image';
import { appendPicktyWatermark, formatImageCaptureError } from '@/lib/tier-capture-png';
import type { WorldCupMatchHistoryEntry } from '@/lib/store/worldcup-store';

const CAPTURE_WIDTH = 720;

export { formatImageCaptureError };

function entryLabel(e: WorldCupMatchHistoryEntry): string {
  switch (e.kind) {
    case 'selectWinner':
      return `${e.leftName} vs ${e.rightName} → 승: ${e.winnerName}`;
    case 'reroll':
      return `${e.side === 0 ? '좌' : '우'} 교체: ${e.removedName} → ${e.newName}`;
    case 'walkover':
      return `단일 부전승 · 우승 확정: ${e.championName}`;
    default: {
      const _exhaust: never = e;
      return _exhaust;
    }
  }
}

export type BracketCaptureLabels = {
  matchHistory: WorldCupMatchHistoryEntry[];
  championName: string;
  title?: string;
};

/**
 * 대진 이력을 DOM 트리로 구성해 PNG로 캡처합니다. (html-to-image)
 */
export async function captureWorldCupBracketToPng(
  labels: BracketCaptureLabels,
  width: number = CAPTURE_WIDTH,
): Promise<string> {
  const root = document.createElement('div');
  root.style.cssText = [
    'box-sizing:border-box',
    `width:${width}px`,
    'padding:28px 24px 40px',
    'background:#fafafa',
    'color:#18181b',
    'font-family:ui-sans-serif,system-ui,sans-serif',
    'font-size:14px',
    'line-height:1.5',
    'border-radius:12px',
    'border:1px solid #e4e4e7',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = labels.title ?? '이상형 월드컵 대진표';
  title.style.cssText = 'font-size:20px;font-weight:800;margin-bottom:16px;letter-spacing:-0.02em;color:#09090b';
  root.appendChild(title);

  if (labels.matchHistory.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = '기록된 대진 선택이 없습니다.';
    empty.style.cssText = 'color:#71717a;font-size:13px';
    root.appendChild(empty);
  } else {
    const ol = document.createElement('ol');
    ol.style.cssText = 'margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px';
    labels.matchHistory.forEach((entry, i) => {
      const li = document.createElement('li');
      li.style.cssText = 'color:#27272a';
      li.textContent = `${i + 1}. ${entryLabel(entry)}`;
      ol.appendChild(li);
    });
    root.appendChild(ol);
  }

  const win = document.createElement('div');
  win.style.cssText =
    'margin-top:20px;padding-top:16px;border-top:2px solid #fbbf24;font-weight:700;font-size:16px;color:#0a0a0a';
  win.textContent = `최종 우승: ${labels.championName}`;
  root.appendChild(win);

  appendPicktyWatermark(root);

  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'top:100vh',
    'left:0',
    `width:${width}px`,
    'pointer-events:none',
    'z-index:-1',
  ].join(';');
  document.body.appendChild(container);
  container.appendChild(root);

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  try {
    const h = root.scrollHeight;
    return await toPng(root, {
      width,
      height: h,
      style: {
        width: `${width}px`,
        height: `${h}px`,
      },
      includeQueryParams: true,
    });
  } finally {
    document.body.removeChild(container);
  }
}

export function downloadPngDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
