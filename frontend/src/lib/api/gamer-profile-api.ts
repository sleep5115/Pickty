import { apiFetch } from '@/lib/api-fetch';
import { uploadPicktyImages } from '@/lib/image-upload-api';

export type GameSource = 'API' | 'SEARCH' | 'AI' | 'DIRECT';

export type GamerProfileStat = {
  statKey: string;
  statValue: string;
};

export type GamerProfileCard = {
  id?: number;
  gameSlug: string;
  gameSource: GameSource;
  gameTitle: string;
  gameIconUrl: string | null;
  externalApiIdentifier: string | null;
  /** 신문 격자에서 대형 강조할 대표 게임 여부. */
  isMain: boolean;
  stats: GamerProfileStat[];
};

export type GamerProfileFeed = {
  id?: number;
  imageUrl: string;
  description: string | null;
  feedType: 'REALITY' | 'PROOF';
};

export type GamerProfile = {
  slug: string;
  isMember: boolean;
  verified: boolean;
  shareUrl: string | null;
  cards: GamerProfileCard[];
  feeds: GamerProfileFeed[];
  createdAt: string;
  updatedAt: string;
};

/** 편집 폼이 다루는 가변 카드(작성 중 상태). 서버 전송 시 정제. */
export type EditableCard = {
  gameSlug: string;
  gameSource: GameSource;
  gameTitle: string;
  gameIconUrl: string | null;
  externalApiIdentifier: string | null;
  isMain: boolean;
  stats: GamerProfileStat[];
};

export type GamerProfileUpsertInput = {
  cards: EditableCard[];
  feeds: { imageUrl: string; description: string | null; feedType: 'REALITY' | 'PROOF' }[];
};

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asStrOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function parseSource(v: unknown): GameSource {
  return v === 'API' || v === 'SEARCH' || v === 'AI' || v === 'DIRECT' ? v : 'DIRECT';
}

function parseStats(raw: unknown): GamerProfileStat[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map((s) => ({ statKey: asStr(s.statKey), statValue: asStr(s.statValue) }))
    .filter((s) => s.statKey !== '' && s.statValue !== '');
}

function parseCard(raw: Record<string, unknown>): GamerProfileCard {
  return {
    id: typeof raw.id === 'number' ? raw.id : undefined,
    gameSlug: asStr(raw.gameSlug),
    gameSource: parseSource(raw.gameSource),
    gameTitle: asStr(raw.gameTitle),
    gameIconUrl: asStrOrNull(raw.gameIconUrl),
    externalApiIdentifier: asStrOrNull(raw.externalApiIdentifier),
    isMain: Boolean(raw.isMain),
    stats: parseStats(raw.stats),
  };
}

function parseProfile(row: Record<string, unknown>): GamerProfile {
  const cards = Array.isArray(row.cards)
    ? row.cards
        .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
        .map(parseCard)
    : [];
  const feeds = Array.isArray(row.feeds)
    ? row.feeds
        .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
        .map((f) => ({
          id: typeof f.id === 'number' ? f.id : undefined,
          imageUrl: asStr(f.imageUrl),
          description: asStrOrNull(f.description),
          feedType: f.feedType === 'PROOF' ? ('PROOF' as const) : ('REALITY' as const),
        }))
    : [];
  return {
    slug: asStr(row.slug),
    isMember: Boolean(row.isMember),
    verified: Boolean(row.verified),
    shareUrl: asStrOrNull(row.shareUrl),
    cards,
    feeds,
    createdAt: asStr(row.createdAt),
    updatedAt: asStr(row.updatedAt),
  };
}

/** AI 한도 초과·쿼터 소진(429)을 식별하기 위한 에러 타입. UI 는 이걸 잡아 수동 폼으로 폴백. */
export class AiQuotaError extends Error {
  constructor(message = '일일 AI 생성 한도를 모두 소진했습니다. 수동으로 카드를 추가해 주세요.') {
    super(message);
    this.name = 'AiQuotaError';
  }
}

function cardToPayload(c: EditableCard): Record<string, unknown> {
  return {
    gameSlug: c.gameSlug.trim(),
    gameSource: c.gameSource,
    gameTitle: c.gameTitle.trim(),
    gameIconUrl: c.gameIconUrl,
    externalApiIdentifier: c.externalApiIdentifier,
    isMain: c.isMain,
    stats: c.stats
      .map((s) => ({ statKey: s.statKey.trim(), statValue: s.statValue.trim() }))
      .filter((s) => s.statKey !== '' && s.statValue !== ''),
  };
}

function upsertPayload(input: GamerProfileUpsertInput): Record<string, unknown> {
  return {
    cards: input.cards.filter((c) => c.gameTitle.trim() !== '').map(cardToPayload),
    feeds: input.feeds
      .filter((f) => f.imageUrl.trim() !== '')
      .map((f) => ({
        imageUrl: f.imageUrl.trim(),
        description: f.description?.trim() || null,
        feedType: f.feedType,
      })),
  };
}

export async function checkSlug(slug: string): Promise<boolean> {
  const res = await apiFetch(`/api/v1/profile/check-slug?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) return false;
  const row = (await res.json()) as { available?: unknown };
  return Boolean(row.available);
}

export async function getProfile(slug: string): Promise<GamerProfile> {
  const res = await apiFetch(`/api/v1/profile/${encodeURIComponent(slug)}`);
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (!res.ok) throw new Error((await res.text()) || `프로필 조회 실패 (${res.status})`);
  return parseProfile((await res.json()) as Record<string, unknown>);
}

/** 로그인 회원 본인 프로필 슬러그. 없으면 null. */
export async function getMyProfileSlug(): Promise<string | null> {
  const res = await apiFetch('/api/v1/profile/me');
  if (!res.ok) return null;
  const row = (await res.json()) as { slug?: unknown };
  return asStrOrNull(row.slug);
}

export async function createProfile(input: {
  customSlug: string;
  guestPassword: string | null;
  cards: EditableCard[];
  feeds: { imageUrl: string; description: string | null; feedType: 'REALITY' | 'PROOF' }[];
}): Promise<{ slug: string; editToken: string | null }> {
  const payload: Record<string, unknown> = {
    customSlug: input.customSlug.trim(),
    ...upsertPayload(input),
  };
  if (input.guestPassword) payload.guestPassword = input.guestPassword;

  const res = await apiFetch('/api/v1/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.text()) || `프로필 생성 실패 (${res.status})`);
  const row = (await res.json()) as { slug?: unknown; editToken?: unknown };
  return { slug: asStr(row.slug), editToken: asStrOrNull(row.editToken) };
}

export async function updateProfile(
  slug: string,
  input: GamerProfileUpsertInput,
  editToken: string | null,
): Promise<GamerProfile> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (editToken) headers['X-Profile-Edit-Token'] = editToken;
  const res = await apiFetch(`/api/v1/profile/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(upsertPayload(input)),
  });
  if (!res.ok) throw new Error((await res.text()) || `프로필 수정 실패 (${res.status})`);
  return parseProfile((await res.json()) as Record<string, unknown>);
}


export async function verifyProfilePassword(
  slug: string,
  password: string,
): Promise<{ editToken: string; expiresInSeconds: number }> {
  const res = await apiFetch(`/api/v1/profile/${encodeURIComponent(slug)}/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.status === 403) throw new Error('암구호가 일치하지 않습니다.');
  if (!res.ok) throw new Error((await res.text()) || `암구호 검증 실패 (${res.status})`);
  const row = (await res.json()) as { editToken?: unknown; expiresInSeconds?: unknown };
  return {
    editToken: asStr(row.editToken),
    expiresInSeconds: typeof row.expiresInSeconds === 'number' ? row.expiresInSeconds : 3600,
  };
}

export async function aiGenerateCards(text: string): Promise<GamerProfileCard[]> {
  const res = await apiFetch('/api/v1/profile/ai-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (res.status === 429) throw new AiQuotaError();
  if (!res.ok) throw new Error((await res.text()) || `AI 생성 실패 (${res.status})`);
  const row = (await res.json()) as { games?: unknown };
  const games = Array.isArray(row.games) ? row.games : [];
  return games
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map((g) => ({
      gameSlug: asStr(g.gameSlug),
      gameSource: 'AI' as const,
      gameTitle: asStr(g.gameTitle),
      gameIconUrl: asStrOrNull(g.gameIconUrl),
      externalApiIdentifier: null,
      isMain: false,
      stats: parseStats(g.stats),
    }));
}

export async function fetchGameStats(
  gameSlug: string,
  identifier: string,
): Promise<{ gameSlug: string; gameTitle: string; gameIconUrl: string | null; stats: GamerProfileStat[] }> {
  const res = await apiFetch('/api/v1/profile/game-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameSlug, identifier }),
  });
  if (!res.ok) throw new Error((await res.text()) || `게임 전적 조회 실패 (${res.status})`);
  const row = (await res.json()) as Record<string, unknown>;
  return {
    gameSlug: asStr(row.gameSlug),
    gameTitle: asStr(row.gameTitle),
    gameIconUrl: asStrOrNull(row.gameIconUrl),
    stats: parseStats(row.stats),
  };
}

/** 프로필 전용 업로드(비회원 허용). 압축은 공용 모듈 재사용, 엔드포인트만 프로필 경로로. */
export async function uploadProfileImages(
  files: readonly (File | Blob)[],
  accessToken: string | null,
): Promise<string[]> {
  return uploadPicktyImages(files, accessToken, { endpoint: '/api/v1/profile/images' });
}
