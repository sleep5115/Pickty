import { toPng } from 'html-to-image';
import { appendPicktyWatermark, formatImageCaptureError } from '@/lib/tier-capture-png';
import type { WorldCupItem, WorldCupMatchHistoryEntry } from '@/lib/store/worldcup-store';
import { freezeRasterImageUrlToJpegDataUrl } from '@/lib/worldcup/worldcup-raster-static';

export { formatImageCaptureError };

type SelectWinnerEntry = Extract<WorldCupMatchHistoryEntry, { kind: 'selectWinner' }>;

export type BracketCaptureLabels = {
  matchHistory: WorldCupMatchHistoryEntry[];
  championName: string;
  title?: string;
  startBracket?: number;
  /** 썸네일 표시용 — 없으면 텍스트만 표시 */
  items?: WorldCupItem[];
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

// ── 이미지 프리패치 ───────────────────────────────────────────

async function prefetchItemImages(
  items: WorldCupItem[],
  matchIds: Set<number>,
): Promise<Map<number, string>> {
  const targets = items.filter((it) => matchIds.has(it.id) && it.imageUrl?.trim());
  const settled = await Promise.allSettled(
    targets.map(async (it) => {
      const dataUrl = await freezeRasterImageUrlToJpegDataUrl(it.imageUrl!, 80);
      return [it.id, dataUrl] as const;
    }),
  );
  const map = new Map<number, string>();
  for (const r of settled) {
    if (r.status === 'fulfilled') map.set(r.value[0], r.value[1]);
  }
  return map;
}

// ── DOM 빌더 유틸 ─────────────────────────────────────────────

const ITEM_W = 85;
const ITEM_GAP = 5;
const ITEM_IMG_H = 56;
const PAD_L = 52; // Left padding to secure space for round labels
const PAD_R = 28;
const PAD_V = 24;

function css(...rules: string[]): string {
  return rules.join(';');
}

function makeRoundHeader(text: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = css(
    'font-size:10px',
    'font-weight:700',
    'color:#7c3aed',
    'letter-spacing:0.06em',
    'white-space:nowrap',
    'position:absolute',
    'right:calc(100% + 8px)',
    'top:50%',
    'transform:translateY(-50%)',
    'text-align:right',
  );
  el.textContent = text;
  return el;
}

/** 개별 아이템 카드 (참가자 또는 라운드 승자) */
function makeItemCard(name: string, hasImages: boolean, dataUrl?: string, showCheck = false): HTMLElement {
  const card = document.createElement('div');
  card.style.cssText = css(
    `width:${ITEM_W}px`,
    'flex-shrink:0',
    'border-radius:5px',
    'overflow:hidden',
    'border:1.5px solid #e4e4e7',
    'background:#fff',
  );

  if (hasImages) {
    const imgWrap = document.createElement('div');
    imgWrap.style.cssText = css(
      'width:100%',
      `height:${ITEM_IMG_H}px`,
      'background:#d4d4d8',
      'overflow:hidden',
    );
    if (dataUrl) {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      img.alt = '';
      imgWrap.appendChild(img);
    }
    card.appendChild(imgWrap);
  }

  const nameEl = document.createElement('div');
  nameEl.style.cssText = css(
    'padding:3px 4px',
    'font-size:9px',
    'text-align:center',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap',
    showCheck ? 'color:#7c3aed;font-weight:700' : 'color:#09090b;font-weight:500',
  );
  nameEl.textContent = (showCheck ? '✓ ' : '') + name;
  card.appendChild(nameEl);

  return card;
}

function makeChampionBox(name: string, dataUrl?: string): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = css(
    `width:${ITEM_W}px`,
    'flex-shrink:0',
    'border-radius:5px',
    'overflow:hidden',
    'border:2px solid #fbbf24',
    'background:#fffbeb',
  );

  if (dataUrl) {
    const imgWrap = document.createElement('div');
    imgWrap.style.cssText = css(
      'width:100%',
      `height:${ITEM_IMG_H}px`,
      'background:#d4d4d8',
      'overflow:hidden',
    );
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
    img.alt = '';
    imgWrap.appendChild(img);
    box.appendChild(imgWrap);
  }

  const label = document.createElement('div');
  label.style.cssText = css(
    'padding:3px 4px',
    'font-weight:700',
    'font-size:9px',
    'color:#0a0a0a',
    'text-align:center',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap',
  );
  label.textContent = '🏆 ' + name;
  box.appendChild(label);

  return box;
}

function getParticipantCenterX(dr: number, p_idx: number): number {
  const span = Math.pow(2, dr);
  const leftX = p_idx * span * (ITEM_W + ITEM_GAP);
  const rightX = (p_idx * span + span - 1) * (ITEM_W + ITEM_GAP) + ITEM_W;
  return (leftX + rightX) / 2;
}

function createSvgLinesRow(
  dr: number,
  matchCount: number,
  contentW: number,
  lineHeight: number,
  strokeColor: string = '#cbd5e1',
  strokeWidth: number = 2,
): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = css(
    'position:relative',
    `width:${contentW}px`,
    `height:${lineHeight}px`,
  );

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', contentW.toString());
  svg.setAttribute('height', lineHeight.toString());
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';

  for (let i = 0; i < matchCount; i++) {
    const x1 = getParticipantCenterX(dr, 2 * i);
    const x2 = getParticipantCenterX(dr, 2 * i + 1);
    const xMid = (x1 + x2) / 2;

    const yBottom = lineHeight;
    const yMid = lineHeight / 2;
    const yTop = 0;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      `M ${x1} ${yBottom} L ${x1} ${yMid} L ${x2} ${yMid} L ${x2} ${yBottom} M ${xMid} ${yMid} L ${xMid} ${yTop}`,
    );
    path.setAttribute('stroke', strokeColor);
    path.setAttribute('stroke-width', strokeWidth.toString());
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
  }

  container.appendChild(svg);
  return container;
}

// ── 대진표 빌더 ───────────────────────────────────────────────
//
// 각 행을 CSS Grid(N열, 열 너비 ITEM_W, column-gap ITEM_GAP)로 구성한다.
//
// display_row 0 (최하단): rounds[0]의 leftId·rightId를 개별 카드로 N개 나열
//   → 각 매치 i: left at col 2i+1, right at col 2i+2 (span 1)
//
// display_row r (r≥1): rounds[r-1] 각 match의 승자만 배치
//   → span = 2^r, start_col = i * span + 1
//   → justify-self:center 로 하위 두 카드의 정가운데에 위치
//
// champion: display_row rounds.length의 승자를 gold 박스로 별도 표시

function buildBracket(
  rounds: SelectWinnerEntry[][],
  labels: string[],
  champion: string,
  imageMap?: Map<number, string>,
  championId?: number,
): HTMLElement {
  const N = rounds.length > 0 ? rounds[0]!.length * 2 : 2; // = startBracket
  const contentW = N * ITEM_W + (N - 1) * ITEM_GAP;
  const hasImages = imageMap != null && imageMap.size > 0;

  const wrap = document.createElement('div');
  wrap.style.cssText = css(
    'display:flex',
    'flex-direction:column',
    'gap:0px',
    `width:${contentW}px`,
  );

  // 우승자 (최상단, 전체 너비 가운데 정렬)
  const champRow = document.createElement('div');
  champRow.style.cssText = 'display:flex;flex-direction:column;align-items:center;position:relative';
  champRow.appendChild(makeRoundHeader('우승'));
  champRow.appendChild(makeChampionBox(champion, championId != null ? imageMap?.get(championId) : undefined));
  wrap.appendChild(champRow);

  if (rounds.length > 0) {
    wrap.appendChild(createSvgLinesRow(rounds.length - 1, 1, contentW, 24));
  }

  // 결승 → 1라운드 순으로 DOM에 추가 (flex-column → 위에서 아래로)
  for (let dr = rounds.length - 1; dr >= 0; dr--) {
    const span = Math.pow(2, dr);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-direction:column;position:relative';
    row.appendChild(makeRoundHeader(labels[dr] ?? `R${dr}`));

    const cards = document.createElement('div');
    cards.style.cssText = css(
      'display:grid',
      `grid-template-columns:repeat(${N},${ITEM_W}px)`,
      `column-gap:${ITEM_GAP}px`,
      `width:${contentW}px`,
      'position:relative',
      'z-index:1',
    );

    if (dr === 0) {
      // 최하단: 1라운드 참가자 전원을 개별 카드로 순서대로 배치 (승자 ✓ 표시)
      rounds[0]!.forEach((match, i) => {
        const left = makeItemCard(match.leftName, hasImages, imageMap?.get(match.leftId), match.winnerSide === 0);
        left.style.gridColumn = `${i * 2 + 1} / span 1`;
        cards.appendChild(left);

        const right = makeItemCard(match.rightName, hasImages, imageMap?.get(match.rightId), match.winnerSide === 1);
        right.style.gridColumn = `${i * 2 + 2} / span 1`;
        cards.appendChild(right);
      });
    } else {
      // 상위 행: rounds[dr-1] 각 매치의 승자를 span 2^dr 열에 가운데 배치
      // 이 행의 항목들은 rounds[dr]에서 경쟁 → 거기서 이긴 사람에게 ✓ 표시
      const nextRound = rounds[dr];
      rounds[dr - 1]!.forEach((match, i) => {
        const nextMatch = nextRound?.[Math.floor(i / 2)];
        const isWinner = nextMatch != null &&
          ((i % 2 === 0 && nextMatch.winnerSide === 0) ||
           (i % 2 === 1 && nextMatch.winnerSide === 1));
        const card = makeItemCard(match.winnerName, hasImages, imageMap?.get(match.winnerId), isWinner);
        card.style.gridColumn = `${i * span + 1} / span ${span}`;
        card.style.justifySelf = 'center';
        cards.appendChild(card);
      });
    }

    row.appendChild(cards);
    wrap.appendChild(row);

    if (dr > 0) {
      wrap.appendChild(createSvgLinesRow(dr - 1, rounds[dr - 1]!.length, contentW, 24));
    }
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

// ── 텍스트 목록 폴백 ─────────────────────────────────────────

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
  title.style.cssText =
    'font-size:20px;font-weight:800;margin-bottom:16px;letter-spacing:-0.02em;color:#09090b';
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

  // 16강 초과 시 앞 라운드를 잘라 16강부터만 표시
  const MAX_DISPLAY = 16;
  const effectiveBracket = Math.min(startBracket, MAX_DISPLAY);
  const displayWins = startBracket > MAX_DISPLAY
    ? selectWins.slice(startBracket - MAX_DISPLAY)
    : selectWins;

  const matchIds = new Set<number>();
  displayWins.forEach((e) => { matchIds.add(e.leftId); matchIds.add(e.rightId); });

  const lastMatch = selectWins[selectWins.length - 1];
  const championId = lastMatch?.winnerId;
  if (championId != null) matchIds.add(championId);

  let imageMap: Map<number, string> | undefined;
  if (labels.items && labels.items.some((it) => it.imageUrl?.trim())) {
    imageMap = await prefetchItemImages(labels.items, matchIds);
  }

  const rounds = splitIntoRounds(displayWins, effectiveBracket);
  const rLabels = rounds.map((_, i) => roundLabel(effectiveBracket, i));

  // 이미지 너비: 표시 라운드 참가자 수(= effectiveBracket) 기준
  const imageWidth = PAD_L + PAD_R + effectiveBracket * ITEM_W + (effectiveBracket - 1) * ITEM_GAP;

  const root = document.createElement('div');
  root.style.cssText = css(
    'box-sizing:border-box',
    `width:${imageWidth}px`,
    `padding:${PAD_V}px ${PAD_R}px 36px ${PAD_L}px`,
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

  root.appendChild(buildBracket(rounds, rLabels, labels.championName, imageMap, championId));

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
