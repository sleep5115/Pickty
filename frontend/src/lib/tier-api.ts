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
}

export interface TemplateDetailResponse {
  id: string;
  title: string;
  version: number;
  parentTemplateId: string | null;
  items: Record<string, unknown>;
  thumbnailUrls?: string[];
  /** DB `list_thumbnail_uses_custom` — 커스텀 커버 한 장 vs 아이템 그리드 */
  listThumbnailUsesCustom?: boolean;
}

export interface TemplateSummaryResponse {
  id: string;
  title: string;
  version: number;
  itemCount: number;
  description: string | null;
  thumbnailUrls: string[];
  listThumbnailUsesCustom?: boolean;
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
  /** Fork 시 부모 템플릿 UUID */
  parentTemplateId?: string | null;
  /** 초기 템플릿은 1 고정. 서버가 무시할 수 있으나 Phase 2 계약용으로 전송 */
  version?: number;
  /** 카드 썸네일 URL 최대 4개 */
  thumbnailUrls?: string[];
  /** `true`면 커스텀 커버 1장 모드(서버 컬럼 `list_thumbnail_uses_custom`) */
  listThumbnailUsesCustom?: boolean;
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

/** API/직렬화에 따라 camelCase 또는 snake_case로 올 수 있음. DB·역직렬화로 JSON 문자열 한 덩어리로 올 때도 처리 */
function parseTemplateThumbnailUrls(raw: Record<string, unknown>): string[] {
  let v: unknown = raw.thumbnailUrls ?? raw.thumbnail_urls;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) {
      v = undefined;
    } else {
      try {
        v = JSON.parse(t) as unknown;
      } catch {
        return [resolvePicktyUploadsUrl(t)];
      }
    }
  }
  if (Array.isArray(v) && v.length > 0) {
    return v
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      .map((u) => resolvePicktyUploadsUrl(u));
  }
  /** 운영 등 레거시: 목록에 `thumbnailUrls` 대신 단일 `thumbnailUrl` 문자열만 오는 경우 */
  const single = raw.thumbnailUrl ?? raw.thumbnail_url;
  if (typeof single === 'string' && single.trim()) {
    return [resolvePicktyUploadsUrl(single.trim())];
  }
  return [];
}

function parseListThumbnailUsesCustom(raw: Record<string, unknown>): boolean {
  const v = raw.listThumbnailUsesCustom ?? raw.list_thumbnail_uses_custom;
  return v === true;
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

export async function listTemplates(): Promise<TemplateSummaryResponse[]> {
  const res = await apiFetch('/api/v1/templates');
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `템플릿 목록을 불러오지 못했습니다 (${res.status})`);
  }
  const list = (await res.json()) as Record<string, unknown>[];
  return list.map((row) => {
    const t = row as unknown as TemplateSummaryResponse;
    return {
      ...t,
      thumbnailUrls: parseTemplateThumbnailUrls(row),
      listThumbnailUsesCustom: parseListThumbnailUsesCustom(row),
    };
  });
}

export async function getTemplate(id: string): Promise<TemplateDetailResponse> {
  const res = await apiFetch(`/api/v1/templates/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `템플릿을 불러오지 못했습니다 (${res.status})`);
  }
  return res.json() as Promise<TemplateDetailResponse>;
}

/** 템플릿 생성 (Fork 시 parentTemplateId·version 등 확장 필드 전달) */
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
  return res.json() as Promise<TemplateResponse>;
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
