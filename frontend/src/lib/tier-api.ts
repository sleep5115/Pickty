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
}

export interface TemplateSummaryResponse {
  id: string;
  title: string;
  version: number;
  itemCount: number;
  description: string | null;
  thumbnailUrl: string | null;
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
  userId: number | null;
  thumbnailUrl: string | null;
}

export interface TierResultSummaryResponse {
  id: string;
  templateId: string;
  templateTitle: string;
  templateVersion: number;
  listTitle: string | null;
  listDescription: string | null;
  isPublic: boolean;
  createdAt: string;
  thumbnailUrl: string | null;
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
  return {
    id,
    title,
    version,
    itemCount,
    description,
    thumbnailUrl: parseTemplateThumbnailUrl(row),
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
  return {
    ...base,
    thumbnailUrl: parseTemplateThumbnailUrl(row),
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
  return rows.map((row) => {
    const r = row as unknown as TierResultSummaryResponse;
    return {
      ...r,
      thumbnailUrl: parseResultThumbnailUrl(row),
    };
  });
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
    snapshotData: rewriteSnapshotUploadedImageUrls(raw.snapshotData),
    thumbnailUrl: parseResultThumbnailUrl(row),
  };
}
