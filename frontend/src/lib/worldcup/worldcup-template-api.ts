import type { ReactionType } from '@/lib/api/interaction-api';
import { apiFetch } from '@/lib/api-fetch';

function authHeaders(token: string | null): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** `GET /api/v1/worldcup/templates` 항목 */
export interface WorldCupTemplateSummaryDto {
  id: string;
  title: string;
  version: number;
  description: string | null;
  thumbnailUrl: string | null;
  creatorId: number | null;
  layoutMode: string;
  itemCount: number;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  myReaction?: ReactionType | null;
}

export function fetchWorldCupTemplateList(accessToken: string | null = null) {
  return apiFetch('/api/v1/worldcup/templates', {
    headers: { ...authHeaders(accessToken) },
  });
}

/** `GET /api/v1/worldcup/templates/{id}` 응답 */
export interface WorldCupTemplateDetailDto {
  id: string;
  title: string;
  version: number;
  description: string | null;
  items: Record<string, unknown>;
  thumbnailUrl: string | null;
  creatorId: number | null;
  layoutMode: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
}

export function fetchWorldCupTemplate(templateId: string, init?: RequestInit) {
  return apiFetch(`/api/v1/worldcup/templates/${encodeURIComponent(templateId)}`, init ?? {});
}

export interface CreateWorldCupTemplatePayload {
  title: string;
  description: string | null;
  layoutMode: 'split_lr' | 'split_diagonal';
  items: { id: string; name: string; imageUrl?: string | null }[];
  /** 합성·직접 업로드한 목록 썸네일. 생략 시 서버가 첫 미디어 등으로 추론 */
  thumbnailUrl?: string | null;
}

export interface WorldCupTemplateCreatedDto {
  id: string;
  title: string;
  version: number;
  creatorId: number | null;
  thumbnailUrl: string | null;
}

export async function createWorldCupTemplate(
  body: CreateWorldCupTemplatePayload,
  accessToken: string | null,
): Promise<WorldCupTemplateCreatedDto> {
  const res = await apiFetch('/api/v1/worldcup/templates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(accessToken),
    },
    body: JSON.stringify({
      title: body.title,
      description: body.description,
      layoutMode: body.layoutMode,
      items: { items: body.items },
      thumbnailUrl: body.thumbnailUrl?.trim() ? body.thumbnailUrl.trim() : null,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `월드컵 템플릿 저장 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  return {
    id: String(row.id ?? ''),
    title: typeof row.title === 'string' ? row.title : '',
    version: typeof row.version === 'number' ? row.version : Number(row.version) || 1,
    creatorId:
      row.creatorId === null || row.creatorId === undefined
        ? null
        : typeof row.creatorId === 'number'
          ? row.creatorId
          : Number(row.creatorId),
    thumbnailUrl:
      row.thumbnailUrl === null || row.thumbnailUrl === undefined
        ? null
        : String(row.thumbnailUrl),
  };
}

export interface PatchWorldCupMetaResponse {
  id: string;
  title: string;
  version: number;
  description: string | null;
  layoutMode: string;
}

export async function patchWorldCupTemplateMeta(
  id: string,
  body: {
    title: string;
    description: string | null;
    layoutMode?: 'split_lr' | 'split_diagonal';
  },
  accessToken: string | null,
): Promise<PatchWorldCupMetaResponse> {
  const payload: Record<string, unknown> = {
    title: body.title,
    description: body.description,
  };
  if (body.layoutMode != null) {
    payload.layoutMode = body.layoutMode;
  }
  const res = await apiFetch(`/api/v1/worldcup/templates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(accessToken),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `월드컵 템플릿 수정 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  const desc = row.description;
  const lm = row.layoutMode;
  return {
    id: String(row.id ?? ''),
    title: typeof row.title === 'string' ? row.title : '',
    version: typeof row.version === 'number' ? row.version : Number(row.version) || 0,
    description: typeof desc === 'string' ? desc : null,
    layoutMode: typeof lm === 'string' ? lm : 'split_lr',
  };
}

export async function deleteWorldCupTemplate(id: string, accessToken: string | null): Promise<void> {
  const res = await apiFetch(`/api/v1/worldcup/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(accessToken) },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `월드컵 템플릿 삭제 실패 (${res.status})`);
  }
}
