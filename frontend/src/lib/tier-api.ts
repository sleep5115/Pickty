import { apiFetch } from '@/lib/api-fetch';
import { resolvePicktyUploadsUrl } from '@/lib/pickty-image-url';
import type { TierItem } from '@/lib/store/tier-store';
import { rewriteSnapshotUploadedImageUrls } from '@/lib/tier-snapshot';
import type { TierSnapshotPayload } from '@/lib/tier-snapshot';

export interface TemplateResponse {
  id: string;
  title: string;
  version: number;
  parentTemplateId: string | null;
  creatorId: number | null;
  /** POST 생성 응답에 포함 — 저장 반영 여부 확인용 */
  thumbnailUrl?: string | null;
  /**
   * createTemplate 전용 — 응답 JSON에 thumbnailUrl/thumbnail_url 키가 실제로 있었는지.
   * (구 API·Jackson null 생략과 구분해 클라이언트 검증에 사용)
   */
  thumbnailFieldInResponse?: boolean;
}

export interface TemplateDetailResponse {
  id: string;
  title: string;
  version: number;
  parentTemplateId: string | null;
  items: Record<string, unknown>;
  /** 단일 썸네일 URL */
  thumbnailUrl?: string | null;
  creatorId?: number | null;
  likeCount?: number;
  commentCount?: number;
}

export interface TemplateMetaPatchResponse {
  id: string;
  title: string;
  version: number;
  description: string | null;
}

export interface TemplateSummaryResponse {
  id: string;
  title: string;
  version: number;
  itemCount: number;
  description: string | null;
  thumbnailUrl: string | null;
  /** 작성자 id — 없으면 null */
  creatorId: number | null;
  likeCount?: number;
  commentCount?: number;
}

/** 템플릿 items JSONB의 `description` 문자열 (없으면 null) */
export function templateItemsDescription(items: Record<string, unknown>): string | null {
  const d = items.description;
  return typeof d === 'string' && d.trim() ? d.trim() : null;
}

/** 템플릿 JSONB에서 티어 풀 아이템만 추출 (description 등 메타는 무시) */
export function templatePayloadToTierItems(payload: Record<string, unknown>): TierItem[] {
  const raw = payload.items;
  if (!Array.isArray(raw)) return [];
  const out: TierItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : String(o.id ?? '');
    const name = typeof o.name === 'string' ? o.name : String(o.name ?? '');
    const rawUrl =
      typeof o.imageUrl === 'string' && o.imageUrl.length > 0 ? o.imageUrl : undefined;
    const imageUrl = rawUrl ? resolvePicktyUploadsUrl(rawUrl) : undefined;
    if (!id) continue;
    out.push({ id, name, imageUrl });
  }
  return out;
}

export type CreateTemplatePayload = {
  title: string;
  items: {
    description?: string | null;
    items: Array<{ id: string; name: string; imageUrl?: string | null }>;
  };
  parentTemplateId?: string | null;
  version?: number;
  /** 단일 썸네일 */
  thumbnailUrl?: string | null;
};

/** `tier_results.result_status` — 백엔드 [ResultStatus] */
export type TierResultStatus = 'ACTIVE' | 'DELETED';

export interface TierResultResponse {
  id: string;
  templateId: string;
  templateTitle: string;
  templateVersion: number;
  listTitle: string | null;
  listDescription: string | null;
  snapshotData: Record<string, unknown>;
  isPublic: boolean;
  isTemporary: boolean;
  resultStatus: TierResultStatus;
  userId: number | null;
  thumbnailUrl: string | null;
  upCount?: number;
  downCount?: number;
  commentCount?: number;
}

export interface TierResultSummaryResponse {
  id: string;
  templateId: string;
  templateTitle: string;
  templateVersion: number;
  listTitle: string | null;
  listDescription: string | null;
  isPublic: boolean;
  resultStatus: TierResultStatus;
  /** null 이면 익명·미귀속 */
  userId: number | null;
  createdAt: string;
  thumbnailUrl: string | null;
  upCount?: number;
  downCount?: number;
  commentCount?: number;
}

export interface PageTierResultSummary {
  content: TierResultSummaryResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

function authHeaders(token: string | null | undefined): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** API 응답에서 템플릿 단일 썸네일 URL (레거시 jsonb 배열 첫 요소도 허용) */
export function parseTemplateThumbnailUrl(raw: Record<string, unknown>): string | null {
  const single = raw.thumbnailUrl ?? raw.thumbnail_url;
  if (typeof single === 'string' && single.trim()) {
    return resolvePicktyUploadsUrl(single.trim());
  }
  let v: unknown = raw.thumbnailUrls ?? raw.thumbnail_urls;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    try {
      v = JSON.parse(t) as unknown;
    } catch {
      return resolvePicktyUploadsUrl(t);
    }
  }
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string' && v[0].trim()) {
    return resolvePicktyUploadsUrl(v[0].trim());
  }
  return null;
}

function optStringField(row: Record<string, unknown>, camel: string, snake: string): string | null {
  const a = row[camel];
  const b = row[snake];
  if (typeof a === 'string') return a;
  if (typeof b === 'string') return b;
  return null;
}

function optLongField(row: Record<string, unknown>, camel: string, snake: string): number {
  const v = row[camel] ?? row[snake];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = v != null && v !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function parseTierResultStatus(row: Record<string, unknown>): TierResultStatus {
  const v = row.resultStatus ?? row.result_status;
  if (v === 'DELETED') return 'DELETED';
  return 'ACTIVE';
}

export function mapTierResultSummaryRow(row: Record<string, unknown>): TierResultSummaryResponse {
  const uidRaw = row.userId ?? row.user_id;
  let userId: number | null = null;
  if (uidRaw != null && uidRaw !== '') {
    const n = typeof uidRaw === 'number' ? uidRaw : Number(uidRaw);
    if (Number.isFinite(n)) userId = n;
  }
  return {
    id: row.id != null ? String(row.id) : '',
    templateId: row.templateId != null ? String(row.templateId) : String(row.template_id ?? ''),
    templateTitle:
      typeof row.templateTitle === 'string'
        ? row.templateTitle
        : typeof row.template_title === 'string'
          ? row.template_title
          : '',
    templateVersion:
      typeof row.templateVersion === 'number'
        ? row.templateVersion
        : Number(row.template_version) || 0,
    listTitle: optStringField(row, 'listTitle', 'list_title'),
    listDescription: optStringField(row, 'listDescription', 'list_description'),
    isPublic: Boolean(row.isPublic ?? row.is_public),
    resultStatus: parseTierResultStatus(row),
    userId,
    createdAt:
      typeof row.createdAt === 'string'
        ? row.createdAt
        : typeof row.created_at === 'string'
          ? row.created_at
          : '',
    thumbnailUrl: parseResultThumbnailUrl(row),
    upCount: optLongField(row, 'upCount', 'up_count'),
    downCount: optLongField(row, 'downCount', 'down_count'),
    commentCount: optLongField(row, 'commentCount', 'comment_count'),
  };
}

export function parseResultThumbnailUrl(raw: Record<string, unknown>): string | null {
  let v: unknown = raw.thumbnailUrl ?? raw.thumbnail_url;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    try {
      const parsed = JSON.parse(t) as unknown;
      if (typeof parsed === 'string' && parsed.trim()) {
        v = parsed;
      } else {
        v = t;
      }
    } catch {
      v = t;
    }
  }
  if (typeof v !== 'string' || !v.trim()) return null;
  return resolvePicktyUploadsUrl(v.trim());
}

function mapTemplateSummaryRow(row: Record<string, unknown>): TemplateSummaryResponse {
  const id = row.id != null ? String(row.id) : '';
  const title = typeof row.title === 'string' ? row.title : '';
  const version = typeof row.version === 'number' ? row.version : Number(row.version) || 0;
  const itemCountRaw = row.itemCount ?? row.item_count;
  const itemCount =
    typeof itemCountRaw === 'number' ? itemCountRaw : Number(itemCountRaw) || 0;
  const desc = row.description;
  const description = typeof desc === 'string' ? desc : null;
  const cr = row.creatorId ?? row.creator_id;
  const creatorIdNum =
    cr === null || cr === undefined || cr === '' ? NaN : Number(cr);
  return {
    id,
    title,
    version,
    itemCount,
    description,
    thumbnailUrl: parseTemplateThumbnailUrl(row),
    creatorId: Number.isFinite(creatorIdNum) ? creatorIdNum : null,
    likeCount: optLongField(row, 'likeCount', 'like_count'),
    commentCount: optLongField(row, 'commentCount', 'comment_count'),
  };
}

export async function listTemplates(): Promise<TemplateSummaryResponse[]> {
  const res = await apiFetch('/api/v1/templates');
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `템플릿 목록을 불러오지 못했습니다 (${res.status})`);
  }
  const raw = (await res.json()) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error('템플릿 목록 응답 형식이 올바르지 않습니다.');
  }
  return raw.map((row) => {
    if (!row || typeof row !== 'object') {
      throw new Error('템플릿 목록 행 형식이 올바르지 않습니다.');
    }
    return mapTemplateSummaryRow(row as Record<string, unknown>);
  });
}

export async function getTemplate(id: string): Promise<TemplateDetailResponse> {
  const res = await apiFetch(`/api/v1/templates/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `템플릿을 불러오지 못했습니다 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  const base = row as unknown as TemplateDetailResponse;
  const cr = row.creatorId ?? row.creator_id;
  const creatorIdNum =
    cr === null || cr === undefined || cr === '' ? NaN : Number(cr);
  return {
    ...base,
    thumbnailUrl: parseTemplateThumbnailUrl(row),
    creatorId: Number.isFinite(creatorIdNum) ? creatorIdNum : null,
    likeCount: optLongField(row, 'likeCount', 'like_count'),
    commentCount: optLongField(row, 'commentCount', 'comment_count'),
  };
}

function mapTemplateCreateResponse(row: Record<string, unknown>): TemplateResponse {
  const pt = row.parentTemplateId ?? row.parent_template_id;
  const parentTemplateId =
    pt === null || pt === undefined || pt === '' ? null : String(pt);
  const cr = row.creatorId ?? row.creator_id;
  const creatorIdNum =
    cr === null || cr === undefined || cr === '' ? NaN : Number(cr);
  const thumbnailFieldInResponse =
    Object.prototype.hasOwnProperty.call(row, 'thumbnailUrl') ||
    Object.prototype.hasOwnProperty.call(row, 'thumbnail_url');
  return {
    id: String(row.id ?? ''),
    title: typeof row.title === 'string' ? row.title : '',
    version: typeof row.version === 'number' ? row.version : Number(row.version) || 0,
    parentTemplateId,
    creatorId: Number.isFinite(creatorIdNum) ? creatorIdNum : null,
    thumbnailUrl: parseTemplateThumbnailUrl(row),
    thumbnailFieldInResponse,
  };
}

export async function createTemplate(
  body: CreateTemplatePayload,
  accessToken: string | null,
): Promise<TemplateResponse> {
  const res = await apiFetch('/api/v1/templates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(accessToken),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `템플릿 저장 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  return mapTemplateCreateResponse(row);
}

export async function patchTemplateMeta(
  id: string,
  body: { title: string; description: string | null },
  accessToken: string | null,
): Promise<TemplateMetaPatchResponse> {
  const res = await apiFetch(`/api/v1/templates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(accessToken),
    },
    body: JSON.stringify({
      title: body.title,
      description: body.description,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `템플릿 수정 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  const desc = row.description;
  return {
    id: String(row.id ?? ''),
    title: typeof row.title === 'string' ? row.title : '',
    version: typeof row.version === 'number' ? row.version : Number(row.version) || 0,
    description: typeof desc === 'string' ? desc : null,
  };
}

export async function deleteTemplate(id: string, accessToken: string | null): Promise<void> {
  const res = await apiFetch(`/api/v1/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(accessToken) },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `템플릿 삭제 실패 (${res.status})`);
  }
}

export async function createTierResult(
  body: {
    templateId: string;
    snapshotData: TierSnapshotPayload;
    isPublic?: boolean;
    listTitle?: string | null;
    listDescription?: string | null;
    thumbnailUrl?: string | null;
  },
  accessToken: string | null,
): Promise<TierResultResponse> {
  const res = await apiFetch('/api/v1/tiers/results', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(accessToken),
    },
    body: JSON.stringify({
      templateId: body.templateId,
      snapshotData: body.snapshotData,
      isPublic: body.isPublic ?? false,
      listTitle: body.listTitle ?? null,
      listDescription: body.listDescription ?? null,
      thumbnailUrl: body.thumbnailUrl ?? null,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `결과 저장 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  const raw = row as unknown as TierResultResponse;
  return {
    ...raw,
    resultStatus: parseTierResultStatus(row),
    thumbnailUrl: parseResultThumbnailUrl(row),
  };
}

export async function listMyTierResults(accessToken: string | null): Promise<TierResultSummaryResponse[]> {
  const res = await apiFetch('/api/v1/tiers/results/mine', {
    headers: { ...authHeaders(accessToken) },
  });
  if (res.status === 401) {
    throw new Error('401 Unauthorized');
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `내 티어표 목록을 불러오지 못했습니다 (${res.status})`);
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map((row) => mapTierResultSummaryRow(row));
}

export async function listTierResultsFeedPage(
  page: number,
  size = 12,
): Promise<PageTierResultSummary> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: 'createdAt,desc',
  });
  const res = await apiFetch(`/api/v1/tiers/results?${params.toString()}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `피드를 불러오지 못했습니다 (${res.status})`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const rawContent = body.content;
  const content = Array.isArray(rawContent)
    ? rawContent.map((row) =>
        row && typeof row === 'object' ? mapTierResultSummaryRow(row as Record<string, unknown>) : null,
      )
    : [];
  const filtered = content.filter((x): x is TierResultSummaryResponse => x != null);
  return {
    content: filtered,
    totalElements: Number(body.totalElements ?? body.total_elements) || 0,
    totalPages: Number(body.totalPages ?? body.total_pages) || 0,
    size: Number(body.size) || size,
    number: Number(body.number) || page,
    first: Boolean(body.first),
    last: Boolean(body.last),
    empty: Boolean(body.empty),
  };
}

export async function getTierResult(id: string): Promise<TierResultResponse> {
  const res = await apiFetch(`/api/v1/tiers/results/${id}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `결과를 불러오지 못했습니다 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  const raw = row as unknown as TierResultResponse;
  return {
    ...raw,
    resultStatus: parseTierResultStatus(row),
    snapshotData: rewriteSnapshotUploadedImageUrls(raw.snapshotData),
    thumbnailUrl: parseResultThumbnailUrl(row),
    upCount: optLongField(row, 'upCount', 'up_count'),
    downCount: optLongField(row, 'downCount', 'down_count'),
    commentCount: optLongField(row, 'commentCount', 'comment_count'),
  };
}

export async function patchTierResultMeta(
  id: string,
  body: { title: string | null; description: string | null },
  accessToken: string | null,
): Promise<TierResultResponse> {
  const res = await apiFetch(`/api/v1/tiers/results/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(accessToken),
    },
    body: JSON.stringify({
      title: body.title,
      description: body.description,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `수정 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  const raw = row as unknown as TierResultResponse;
  return {
    ...raw,
    resultStatus: parseTierResultStatus(row),
    snapshotData: rewriteSnapshotUploadedImageUrls(raw.snapshotData),
    thumbnailUrl: parseResultThumbnailUrl(row),
  };
}

export async function deleteTierResult(id: string, accessToken: string | null): Promise<void> {
  const res = await apiFetch(`/api/v1/tiers/results/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(accessToken) },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `삭제 실패 (${res.status})`);
  }
}
