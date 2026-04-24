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

/** Spring 기본 JSON·Gemini 과부하 등 — 원문 JSON 대신 안내 */
const MSG_GEMINI_BUSY =
  '지금 Gemini 서비스에 트래픽이 몰려 일시적으로 응답이 어려운 상태일 수 있어요. 조금 있다가 다시 시도해 주세요.';

const MSG_RATE_LIMIT =
  'Gemini API 호출 한도에 걸렸어요. 무료 등급은 모델·프로젝트마다 일일·분당 제한이 있어요. 응답에 나온 시간(예: 약 20초) 뒤에 다시 시도하거나, Google AI Studio에서 할당량·요금제를 확인해 주세요.';

/** 백엔드가 500으로 감싼 경우 등 — 본문에 Gemini 429/쿼터 JSON이 섞여 있으면 한도 안내로 바꿈 */
function messageFromGeminiQuotaBody(bodyText: string): string | null {
  const t = bodyText;
  if (!t.includes('RESOURCE_EXHAUSTED') && !/quota|free_tier|generate_content_free/i.test(t)) return null;
  try {
    const o = JSON.parse(t.trim()) as Record<string, unknown>;
    const err = o.error as Record<string, unknown> | undefined;
    const msg = typeof err?.message === 'string' ? err.message : '';
    if (/quota|exceeded|free_tier|rate limit|RESOURCE_EXHAUSTED/i.test(msg) || /quota|free_tier/i.test(t)) {
      return MSG_RATE_LIMIT;
    }
  } catch {
    if (/RESOURCE_EXHAUSTED|quota exceeded|free_tier/i.test(t)) return MSG_RATE_LIMIT;
  }
  return null;
}

function messageForAutoGenerateFailure(status: number, bodyText: string): string {
  const quotaHint = messageFromGeminiQuotaBody(bodyText);
  if (quotaHint) return quotaHint;

  if (status === 403) return '이 기능을 사용할 권한이 없습니다.';
  if (status === 429) return MSG_RATE_LIMIT;
  if (status >= 500 && status <= 504) return MSG_GEMINI_BUSY;

  const trimmed = bodyText.trim();
  if (trimmed.startsWith('{')) {
    try {
      const o = JSON.parse(trimmed) as Record<string, unknown>;
      const s = typeof o.status === 'number' ? o.status : Number(o.status);
      if (Number.isFinite(s) && s >= 500 && s <= 504) return MSG_GEMINI_BUSY;
      if (s === 429) return MSG_RATE_LIMIT;
      const err = o.error;
      if (typeof err === 'string' && /internal server error/i.test(err)) return MSG_GEMINI_BUSY;
    } catch {
      /* ignore */
    }
  }
  if (/internal server error/i.test(trimmed)) return MSG_GEMINI_BUSY;

  if (trimmed.startsWith('{') || trimmed.length > 240) {
    return `${MSG_GEMINI_BUSY} (코드 ${status})`;
  }
  return trimmed || `AI 생성 요청 실패 (${status})`;
}

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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(messageForAutoGenerateFailure(res.status, t));
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
