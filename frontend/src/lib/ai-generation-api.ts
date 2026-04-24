import { apiFetch } from '@/lib/api-fetch';

export type AiMediaTypeWire = 'PHOTO' | 'GIF' | 'YOUTUBE';

export type AiMediaCandidateDto = {
  url: string;
  title?: string;
};

export type AiAutoGenerateItemDto = {
  name: string;
  candidates: AiMediaCandidateDto[];
};

function parseMediaCandidates(row: Record<string, unknown>): AiMediaCandidateDto[] {
  if (Array.isArray(row.candidates)) {
    const out: AiMediaCandidateDto[] = [];
    for (const c of row.candidates) {
      if (!c || typeof c !== 'object') continue;
      const o = c as Record<string, unknown>;
      const url = typeof o.url === 'string' ? o.url.trim() : '';
      if (!url) continue;
      const rawTitle = o.title;
      const title =
        typeof rawTitle === 'string' && rawTitle.trim().length > 0 ? rawTitle.trim() : undefined;
      out.push(title ? { url, title } : { url });
    }
    return out;
  }
  if (Array.isArray(row.candidateUrls)) {
    return row.candidateUrls
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      .map((url) => ({ url: url.trim() }));
  }
  return [];
}

export async function postAiAutoGenerate(
  accessToken: string,
  body: { prompt: string; mediaType: AiMediaTypeWire; count?: number },
): Promise<AiAutoGenerateItemDto[]> {
  const res = await apiFetch('/api/v1/admin/ai/auto-generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: body.prompt,
      mediaType: body.mediaType,
      count: body.count ?? 2,
    }),
  });
  if (res.status === 403) {
    throw new Error('이 기능을 사용할 권한이 없습니다.');
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `AI 생성 요청 실패 (${res.status})`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다.');
  }
  return data.map((row) => {
    const r = row as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name : '';
    return { name, candidates: parseMediaCandidates(r) };
  });
}
