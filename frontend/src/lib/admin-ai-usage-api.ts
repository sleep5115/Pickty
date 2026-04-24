import { apiFetch } from '@/lib/api-fetch';

export type AdminAiUsageDto = {
  youtube: number;
  googleSearch: number;
};

export async function fetchAdminAiUsage(accessToken: string): Promise<AdminAiUsageDto> {
  const res = await apiFetch('/api/v1/admin/ai/usage', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `사용량 조회 실패 (${res.status})`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  const yt = row.youtube;
  const gs = row.googleSearch ?? row.google_search;
  return {
    youtube: typeof yt === 'number' && Number.isFinite(yt) ? Math.max(0, Math.floor(yt)) : Math.max(0, Math.floor(Number(yt)) || 0),
    googleSearch:
      typeof gs === 'number' && Number.isFinite(gs) ? Math.max(0, Math.floor(gs)) : Math.max(0, Math.floor(Number(gs)) || 0),
  };
}
