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
  /** Fork 시 부모 템플릿 UUID */
  parentTemplateId?: string | null;
  /** 초기 템플릿은 1 고정. 서버가 무시할 수 있으나 Phase 2 계약용으로 전송 */
  version?: number;
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
}

function authHeaders(token: string | null | undefined): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function listTemplates(): Promise<TemplateSummaryResponse[]> {
  const res = await apiFetch('/api/v1/templates');
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `템플릿 목록을 불러오지 못했습니다 (${res.status})`);
  }
  const list = (await res.json()) as TemplateSummaryResponse[];
  return list.map((t) => ({
    ...t,
    thumbnailUrl: t.thumbnailUrl ? resolvePicktyUploadsUrl(t.thumbnailUrl) : null,
  }));
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
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `결과 저장 실패 (${res.status})`);
  }
  return res.json() as Promise<TierResultResponse>;
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
  return res.json() as Promise<TierResultSummaryResponse[]>;
}

export async function getTierResult(id: string): Promise<TierResultResponse> {
  const res = await apiFetch(`/api/v1/tiers/results/${id}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `결과를 불러오지 못했습니다 (${res.status})`);
  }
  const raw = (await res.json()) as TierResultResponse;
  return {
    ...raw,
    snapshotData: rewriteSnapshotUploadedImageUrls(raw.snapshotData),
  };
}
