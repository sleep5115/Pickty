import { z } from 'zod';
import { resolvePicktyUploadsUrl } from '@/lib/pickty-image-url';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

export interface TemplateBoardSurface {
  backgroundColor?: string;
  backgroundUrl?: string;
}

export interface TemplateBoardRow {
  id: string;
  label: string;
  /** 라벨 칸 배경색(이미지 없을 때·PNG 뒤 깔 색) */
  color: string;
  /** 라벨 글자색 — 없으면 클라이언트가 배경/이미지에 맞춰 대비색 사용 */
  textColor?: string;
  /** 행 배경 이미지가 있을 때 누끼 아래에 `color`를 깔지 여부 */
  paintLabelColorUnderImage?: boolean;
  /**
   * false면 라벨 칸에 `color` 단색/매트를 그리지 않음(표 배경만 비침).
   * 도화지 신규 기본은 false, `기본 세팅` 또는 설정 모달 적용 시 true.
   * 필드 없음(구 저장본)은 true로 간주.
   */
  showLabelColor?: boolean;
  backgroundUrl?: string;
}

export interface TemplateBoardConfig {
  schemaVersion: 1;
  board?: TemplateBoardSurface;
  rows: TemplateBoardRow[];
}

const templateBoardSurfaceSchema = z
  .object({
    backgroundColor: z.string().regex(HEX6).optional(),
    backgroundUrl: z.string().max(2048).optional(),
  })
  .strip();

const templateBoardRowSchema = z
  .object({
    id: z.string().min(1).max(100),
    label: z.string().min(1).max(10),
    color: z.string().regex(HEX6),
    textColor: z.string().regex(HEX6).optional(),
    paintLabelColorUnderImage: z.boolean().optional(),
    showLabelColor: z.boolean().optional(),
    backgroundUrl: z.union([z.string().max(2048), z.null()]).optional(),
  })
  .strip();

const templateBoardConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    board: z.union([templateBoardSurfaceSchema, z.null()]).optional(),
    rows: z.array(templateBoardRowSchema).min(1).max(20),
  })
  .strip();

function normalizeOptionalUrl(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  return resolvePicktyUploadsUrl(t);
}

function normalizeBoardConfig(parsed: z.infer<typeof templateBoardConfigSchema>): TemplateBoardConfig {
  const boardIn = parsed.board;
  let board: TemplateBoardSurface | undefined;
  if (boardIn && typeof boardIn === 'object') {
    const bc = boardIn.backgroundColor?.trim();
    const bu = normalizeOptionalUrl(boardIn.backgroundUrl);
    if (bc || bu) {
      board = {
        ...(bc ? { backgroundColor: bc } : {}),
        ...(bu ? { backgroundUrl: bu } : {}),
      };
    }
  }
  const rows: TemplateBoardRow[] = parsed.rows.map((r) => {
    const bg = r.backgroundUrl == null ? undefined : normalizeOptionalUrl(r.backgroundUrl);
    const tx = r.textColor?.trim();
    return {
      id: r.id.trim(),
      label: r.label.trim(),
      color: r.color.trim(),
      ...(tx && HEX6.test(tx) ? { textColor: tx } : {}),
      ...(typeof r.paintLabelColorUnderImage === 'boolean'
        ? { paintLabelColorUnderImage: r.paintLabelColorUnderImage }
        : {}),
      ...(typeof r.showLabelColor === 'boolean' ? { showLabelColor: r.showLabelColor } : {}),
      ...(bg ? { backgroundUrl: bg } : {}),
    };
  });
  return {
    schemaVersion: 1,
    ...(board ? { board } : {}),
    rows,
  };
}

/**
 * API `board_config` / 임의 JSON을 검증·정규화. 실패 시 null (기본 S~E·테마 배경).
 */
export function parseTemplateBoardConfig(raw: unknown): TemplateBoardConfig | null {
  if (raw == null || typeof raw !== 'object') return null;
  const r = templateBoardConfigSchema.safeParse(raw);
  if (!r.success) return null;
  return normalizeBoardConfig(r.data);
}

/**
 * 템플릿 도화지 기본 행(S~E).
 * `revealLabelColors: true`일 때만 미리보기에 파스텔 라벨 배경을 표시(기본 세팅 버튼).
 */
export function createDefaultTemplateBoardConfig(options?: {
  revealLabelColors?: boolean;
}): TemplateBoardConfig {
  const show = options?.revealLabelColors === true;
  return {
    schemaVersion: 1,
    rows: [
      { id: 'S', label: 'S', color: '#FF7F7F', textColor: '#111827', showLabelColor: show },
      { id: 'A', label: 'A', color: '#FFBF7F', textColor: '#111827', showLabelColor: show },
      { id: 'B', label: 'B', color: '#FFDF7F', textColor: '#111827', showLabelColor: show },
      { id: 'C', label: 'C', color: '#BFFF7F', textColor: '#111827', showLabelColor: show },
      { id: 'D', label: 'D', color: '#7FFF7F', textColor: '#111827', showLabelColor: show },
      { id: 'E', label: 'E', color: '#7FFFFF', textColor: '#111827', showLabelColor: show },
    ],
  };
}

export function cloneTemplateBoardConfig(src: TemplateBoardConfig): TemplateBoardConfig {
  return {
    schemaVersion: 1,
    ...(src.board ? { board: { ...src.board } } : {}),
    rows: src.rows.map((r) => ({
      id: r.id,
      label: r.label,
      color: r.color,
      ...(r.textColor?.trim() ? { textColor: r.textColor.trim() } : {}),
      ...(typeof r.paintLabelColorUnderImage === 'boolean'
        ? { paintLabelColorUnderImage: r.paintLabelColorUnderImage }
        : {}),
      ...(typeof r.showLabelColor === 'boolean' ? { showLabelColor: r.showLabelColor } : {}),
      ...(r.backgroundUrl ? { backgroundUrl: r.backgroundUrl } : {}),
    })),
  };
}

/** `POST /api/v1/templates` 본문용 — 백엔드 DTO와 필드 정합 */
/** 티어 스토어 `tiers` + `workspaceBoardSurface` → 저장용 도화지 객체 */
export function buildTemplateBoardConfigFromEditorState(
  tiers: Array<{
    id: string;
    label: string;
    color: string;
    textColor?: string;
    paintLabelColorUnderImage?: boolean;
    showLabelColor?: boolean;
    backgroundUrl?: string;
  }>,
  workspaceBoardSurface: TemplateBoardSurface | null,
): TemplateBoardConfig {
  const board =
    workspaceBoardSurface &&
    (workspaceBoardSurface.backgroundColor?.trim() ||
      workspaceBoardSurface.backgroundUrl?.trim())
      ? {
          ...(workspaceBoardSurface.backgroundColor?.trim()
            ? { backgroundColor: workspaceBoardSurface.backgroundColor.trim() }
            : {}),
          ...(workspaceBoardSurface.backgroundUrl?.trim()
            ? { backgroundUrl: workspaceBoardSurface.backgroundUrl.trim() }
            : {}),
        }
      : undefined;
  return {
    schemaVersion: 1,
    ...(board && Object.keys(board).length > 0 ? { board } : {}),
    rows: tiers.map((t) => {
      const tx = t.textColor?.trim();
      return {
        id: t.id,
        label: t.label,
        color: t.color,
        ...(tx && HEX6.test(tx) ? { textColor: tx } : {}),
        ...(typeof t.paintLabelColorUnderImage === 'boolean'
          ? { paintLabelColorUnderImage: t.paintLabelColorUnderImage }
          : {}),
        ...(typeof t.showLabelColor === 'boolean' ? { showLabelColor: t.showLabelColor } : {}),
        ...(t.backgroundUrl?.trim() ? { backgroundUrl: t.backgroundUrl.trim() } : {}),
      };
    }),
  };
}

export function templateBoardConfigToApiPayload(cfg: TemplateBoardConfig) {
  const board =
    cfg.board &&
    (cfg.board.backgroundColor?.trim() || cfg.board.backgroundUrl?.trim())
      ? {
          ...(cfg.board.backgroundColor?.trim()
            ? { backgroundColor: cfg.board.backgroundColor.trim() }
            : {}),
          ...(cfg.board.backgroundUrl?.trim()
            ? { backgroundUrl: cfg.board.backgroundUrl.trim() }
            : {}),
        }
      : undefined;
  return {
    schemaVersion: 1 as const,
    ...(board && Object.keys(board).length > 0 ? { board } : {}),
    rows: cfg.rows.map((r) => {
      const tx = r.textColor?.trim();
      return {
        id: r.id.trim(),
        label: r.label.trim(),
        color: r.color.trim(),
        textColor: tx && HEX6.test(tx) ? tx : null,
        paintLabelColorUnderImage:
          r.paintLabelColorUnderImage === true
            ? true
            : r.paintLabelColorUnderImage === false
              ? false
              : null,
        showLabelColor:
          r.showLabelColor === true ? true : r.showLabelColor === false ? false : null,
        backgroundUrl: r.backgroundUrl?.trim() ? r.backgroundUrl.trim() : null,
      };
    }),
  };
}
