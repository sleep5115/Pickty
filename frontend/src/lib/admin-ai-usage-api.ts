import { apiFetch } from '@/lib/api-fetch';

export type AdminAiUsageDto = {
  gemini: number;
  youtube: number;
  googleSearch: number;
};

function floorNonNeg(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n)) return Math.max(0, Math.floor(n));
  const x = Number(n);
  return Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0;
}

export async function fetchAdminAiUsage(accessToken: string): Promise<AdminAiUsageDto> {
  const res = await apiFetch('/api/v1/admin/ai/usage', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `사용량 조회 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  const gm = row.gemini;
  const yt = row.youtube;
  const gs = row.googleSearch ?? row.google_search;
  return {
    gemini: floorNonNeg(gm),
    youtube: floorNonNeg(yt),
    googleSearch: floorNonNeg(gs),
  };
}
