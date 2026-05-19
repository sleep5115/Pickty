import { toPng } from 'html-to-image';
import { appendPicktyWatermark, formatImageCaptureError } from '@/lib/tier-capture-png';
import type { WorldCupMatchHistoryEntry, WorldCupLayoutMode } from '@/lib/store/worldcup-store';

export { formatImageCaptureError };

type SelectWinnerEntry = Extract<WorldCupMatchHistoryEntry, { kind: 'selectWinner' }>;

export type BracketCaptureLabels = {
  matchHistory: WorldCupMatchHistoryEntry[];
  championName: string;
  title?: string;
  layoutMode?: WorldCupLayoutMode;
  startBracket?: number;
};

// ── 라운드 분할 ──────────────────────────────────────────────

function splitIntoRounds(matches: SelectWinnerEntry[], start: number): SelectWinnerEntry[][] {
  const rounds: SelectWinnerEntry[][] = [];
  let remaining = start;
  let offset = 0;
  while (remaining > 1 && offset < matches.length) {
    const count = Math.floor(remaining / 2);
    const slice = matches.slice(offset, offset + count);
    if (slice.length > 0) rounds.push(slice);
    offset += count;
    remaining = Math.ceil(remaining / 2);
  }
  return rounds;
}

function roundLabel(start: number, idx: number): string {
  const players = Math.round(start / Math.pow(2, idx));
  return players <= 2 ? '결승' : `${players}강`;
}

// ── DOM 빌더 유틸 ─────────────────────────────────────────────

const CARD_W_H = 160; // 가로 레이아웃 카드 너비
const CARD_W_V = 150; // 세로 레이아웃 카드 너비
const COL_GAP = 12;
const PAD_H = 28;
const PAD_V = 24;

function css(...rules: string[]): string {
  return rules.join(';');
}

function makeMatchCard(entry: SelectWinnerEntry, cardW: number): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = css(
    `width:${cardW}px`,
    'border-radius:8px',
    'overflow:hidden',
    'border:1px solid #e4e4e7',
    'font-size:11px',
    'line-height:1.4',
    'flex-shrink:0',
  );
  for (const side of [0, 1] as const) {
    if (side === 1) {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:#e4e4e7';
      card.appendChild(sep);
    }
    const isWin = entry.winnerSide === side;
    const name = side === 0 ? entry.leftName : entry.rightName;
    const row = document.createElement('div');
    row.style.cssText = css(
      'padding:5px 7px',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'white-space:nowrap',
      isWin
        ? 'background:#ede9fe;font-weight:600;color:#09090b'
        : 'background:#f4f4f5;color:#a1a1aa',
    );
    row.textContent = (isWin ? '✓ ' : '') + name;
    card.appendChild(row);
  }
  return card;
}

function makeRoundHeader(text: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = css(
    'font-size:10px',
    'font-weight:700',
    'color:#7c3aed',
    'letter-spacing:0.06em',
    'margin-bottom:6px',
    'white-space:nowrap',
  );
  el.textContent = text;
  return el;
}

function makeChampionBox(name: string, cardW: number): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = css(
    `width:${cardW}px`,
    'padding:8px 10px',
    'border-radius:8px',
    'border:2px solid #fbbf24',
    'background:#fffbeb',
    'font-weight:700',
    'font-size:12px',
    'color:#0a0a0a',
    'text-align:center',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap',
  );
  box.textContent = '🏆 ' + name;
  return box;
}

// ── 가로 대진표 (split_diagonal: 왼쪽 → 오른쪽) ──────────────

function buildHorizontalBracket(
  rounds: SelectWinnerEntry[][],
  labels: string[],
  champion: string,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = css(
    'display:flex',
    'flex-direction:row',
    'align-items:flex-start',
    `gap:${COL_GAP}px`,
  );

  rounds.forEach((round, i) => {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column';
    col.appendChild(makeRoundHeader(labels[i] ?? `R${i + 1}`));
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:5px';
    round.forEach((e) => list.appendChild(makeMatchCard(e, CARD_W_H)));
    col.appendChild(list);
    wrap.appendChild(col);
  });

  const champCol = document.createElement('div');
  champCol.style.cssText = 'display:flex;flex-direction:column';
  champCol.appendChild(makeRoundHeader('우승'));
  champCol.appendChild(makeChampionBox(champion, CARD_W_H));
  wrap.appendChild(champCol);

  return wrap;
}

// ── 세로 대진표 (split_lr: 아래 → 위; 이미지 상 결승이 위, 첫 라운드가 아래) ──

function buildVerticalBracket(
  rounds: SelectWinnerEntry[][],
  labels: string[],
  champion: string,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px';

  // 우승자를 이미지 최상단에 배치 (아래→위 흐름에서 도달점이 위쪽)
  const champRow = document.createElement('div');
  champRow.style.cssText = 'display:flex;flex-direction:column';
  champRow.appendChild(makeRoundHeader('우승'));
  champRow.appendChild(makeChampionBox(champion, CARD_W_V));
  wrap.appendChild(champRow);

  // 라운드를 역순으로 배치 (결승 → ... → 첫 라운드가 이미지 하단)
  for (let i = rounds.length - 1; i >= 0; i--) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-direction:column';
    row.appendChild(makeRoundHeader(labels[i] ?? `R${i + 1}`));
    const cards = document.createElement('div');
    cards.style.cssText = 'display:flex;flex-direction:row;flex-wrap:wrap;gap:5px';
    rounds[i]!.forEach((e) => cards.appendChild(makeMatchCard(e, CARD_W_V)));
    row.appendChild(cards);
    wrap.appendChild(row);
  }

  return wrap;
}

// ── 캡처 공통 ─────────────────────────────────────────────────

async function captureDomToPng(root: HTMLElement, width: number): Promise<string> {
  const container = document.createElement('div');
  container.style.cssText = css(
    'position:fixed',
    'top:100vh',
    'left:0',
    `width:${width}px`,
    'pointer-events:none',
    'z-index:-1',
  );
  document.body.appendChild(container);
  container.appendChild(root);

  await new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));

  try {
    const h = root.scrollHeight;
    return await toPng(root, {
      width,
      height: h,
      style: { width: `${width}px`, height: `${h}px` },
      includeQueryParams: true,
    });
  } finally {
    document.body.removeChild(container);
  }
}

// ── 텍스트 목록 폴백 (startBracket 없거나 매치 없을 때) ────────

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

async function captureTextFallback(labels: BracketCaptureLabels): Promise<string> {
  const width = 720;
  const root = document.createElement('div');
  root.style.cssText = css(
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
  );

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
  return captureDomToPng(root, width);
}

// ── 메인 진입점 ───────────────────────────────────────────────

export async function captureWorldCupBracketToPng(labels: BracketCaptureLabels): Promise<string> {
  const selectWins = labels.matchHistory.filter(
    (e): e is SelectWinnerEntry => e.kind === 'selectWinner',
  );

  const startBracket = labels.startBracket ?? 0;
  if (startBracket < 2 || selectWins.length === 0) {
    return captureTextFallback(labels);
  }

  const rounds = splitIntoRounds(selectWins, startBracket);
  const rLabels = rounds.map((_, i) => roundLabel(startBracket, i));
  const isHorizontal = labels.layoutMode === 'split_diagonal';

  // 가로: 라운드 수에 따라 너비 동적 계산, 세로: 고정 720px
  const imageWidth = isHorizontal
    ? PAD_H * 2 + (rounds.length + 1) * CARD_W_H + rounds.length * COL_GAP
    : 720;

  const root = document.createElement('div');
  root.style.cssText = css(
    'box-sizing:border-box',
    `width:${imageWidth}px`,
    `padding:${PAD_V}px ${PAD_H}px 36px`,
    'background:#fafafa',
    'color:#18181b',
    'font-family:ui-sans-serif,system-ui,sans-serif',
    'font-size:14px',
    'line-height:1.5',
    'border-radius:12px',
    'border:1px solid #e4e4e7',
  );

  const titleEl = document.createElement('div');
  titleEl.textContent = (labels.title ? labels.title + ' ' : '') + '대진표';
  titleEl.style.cssText =
    'font-size:18px;font-weight:800;margin-bottom:16px;letter-spacing:-0.02em;color:#09090b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  root.appendChild(titleEl);

  const bracket = isHorizontal
    ? buildHorizontalBracket(rounds, rLabels, labels.championName)
    : buildVerticalBracket(rounds, rLabels, labels.championName);
  root.appendChild(bracket);

  appendPicktyWatermark(root);
  return captureDomToPng(root, imageWidth);
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
