import { apiFetch } from '@/lib/api-fetch';
import { PUBLIC_API_BASE_URL } from '@/lib/public-site-config';
import type { TemplateBoardConfig } from '@/lib/template-board-config';

export type StreamerTemplateType = 'TIER' | 'WORLDCUP';
export type StreamerSessionStatus = 'READY' | 'PLAYING' | 'FINISHED' | 'EXPIRED_FINISHED';
export type StreamerGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface CurrentMatch {
  leftId: string;
  rightId: string;
  label: string | null;
}

export interface CreatedStreamerSession {
  sessionId: string;
  hostToken: string;
  templateType: StreamerTemplateType;
  templateId: string;
  startedAt: number;
}

export interface StreamerStatus {
  sessionId: string;
  status: StreamerSessionStatus;
  templateType: StreamerTemplateType;
  templateId: string;
  version: number;
  currentMatch: CurrentMatch | null;
  quickVoteItemId: string | null;
  nextPollIntervalSeconds: number;
  activeUserCount: number;
  /** 티어 모드 — 방장이 세션에 올린 커스텀 보드 구성. 시청자는 이 보드로 플레이. 월드컵은 null. */
  boardConfig?: TemplateBoardConfig | null;
}

/** 200/304 모두 다음 폴링 가이드 헤더를 함께 전달 */
export interface PollStatusResult {
  /** 200 = 신규 스냅샷, 304 = 변경 없음 */
  changed: boolean;
  body: StreamerStatus | null;
  /** 응답 헤더 X-Next-Poll-Interval → 클라가 다음 setTimeout에 적용 */
  nextPollIntervalSeconds: number;
  /** 새 version (304면 이전 그대로) */
  version: number;
}

/** 방장 — 세션 생성 (로그인 필수). 티어 모드는 방장 커스텀 보드 구성을 함께 올린다. */
export async function createStreamerSession(
  templateType: StreamerTemplateType,
  templateId: string,
  boardConfig?: TemplateBoardConfig,
): Promise<CreatedStreamerSession> {
  const res = await apiFetch('/api/v1/streamer/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateType, templateId, ...(boardConfig ? { boardConfig } : {}) }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `스트리머 세션 생성 실패 (${res.status})`);
  }
  return (await res.json()) as CreatedStreamerSession;
}

/** 방장 — hostToken 유실 시 복구 (로그인 필수, hostUserId 일치 검증) */
export async function fetchFallbackHostToken(sessionId: string): Promise<{ sessionId: string; hostToken: string }> {
  const res = await apiFetch(`/api/v1/streamer/sessions/${encodeURIComponent(sessionId)}/fallback-token`, {
    method: 'GET',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `호스트 토큰 재발급 실패 (${res.status})`);
  }
  return (await res.json()) as { sessionId: string; hostToken: string };
}

/** 방장 — 현재 매치 갱신 */
export async function updateCurrentMatch(
  sessionId: string,
  hostToken: string,
  body: { leftId: string; rightId: string; label?: string | null },
): Promise<{ version: number }> {
  const res = await apiFetch(`/api/v1/streamer/sessions/${encodeURIComponent(sessionId)}/match`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Host-Token': hostToken,
    },
    body: JSON.stringify({
      leftId: body.leftId,
      rightId: body.rightId,
      label: body.label ?? null,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `매치 갱신 실패 (${res.status})`);
  }
  return (await res.json()) as { version: number };
}

/** 방장 — 세션 종료 (영속화 + 통계 이관) */
export async function finishStreamerSession(sessionId: string, hostToken: string): Promise<void> {
  const res = await apiFetch(`/api/v1/streamer/sessions/${encodeURIComponent(sessionId)}/finish`, {
    method: 'POST',
    headers: { 'X-Host-Token': hostToken },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `세션 종료 실패 (${res.status})`);
  }
}

export interface StreamerTierItemStat {
  itemId: string;
  /** rowIndex(문자열) → 표수. */
  distribution: Record<string, number>;
  sampleCount: number;
}

export interface StreamerTierStats {
  totalSubmissions: number;
  items: StreamerTierItemStat[];
}

/** 방장 — 티어 시청자 통계(행별 분포) 조회 */
export async function fetchTierStats(sessionId: string, hostToken: string): Promise<StreamerTierStats> {
  const res = await apiFetch(`/api/v1/streamer/sessions/${encodeURIComponent(sessionId)}/tier-stats`, {
    method: 'GET',
    headers: { 'X-Host-Token': hostToken },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `통계 조회 실패 (${res.status})`);
  }
  const raw = (await res.json()) as {
    totalSubmissions: number | string;
    items: Array<{
      itemId: string;
      distribution: Record<string, number | string>;
      sampleCount: number | string;
    }>;
  };
  return {
    totalSubmissions: Number(raw.totalSubmissions) || 0,
    items: (raw.items ?? []).map((it) => ({
      itemId: it.itemId,
      sampleCount: Number(it.sampleCount) || 0,
      distribution: Object.fromEntries(
        Object.entries(it.distribution ?? {}).map(([k, v]) => [k, Number(v) || 0]),
      ),
    })),
  };
}

export interface StreamerResultListItem {
  id: number;
  templateType: StreamerTemplateType;
  templateId: string;
  finishReason: 'HOST_FINISHED' | 'SWEEPER_EXPIRED';
  tierSubmissions: number;
  startedAt: string;
  finishedAt: string;
}

export interface StreamerResultDetail {
  id: number;
  templateType: StreamerTemplateType;
  templateId: string;
  finishReason: string;
  startedAt: string;
  finishedAt: string;
  /** 저장된 summary — tierStats(아이템별 rowIndex 분포)·boardConfig·tierSubmissions 등. */
  summary: Record<string, unknown>;
}

/** 내 스트리밍 결과 목록 (로그인 필수) */
export async function fetchMyStreamingResults(): Promise<StreamerResultListItem[]> {
  const res = await apiFetch('/api/v1/streamer/results/my', { method: 'GET' });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `결과 목록 조회 실패 (${res.status})`);
  }
  return (await res.json()) as StreamerResultListItem[];
}

/** 내 스트리밍 결과 상세 (로그인 + 본인 소유) */
export async function fetchStreamingResultDetail(id: number | string): Promise<StreamerResultDetail> {
  const res = await apiFetch(`/api/v1/streamer/results/${encodeURIComponent(String(id))}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `결과 조회 실패 (${res.status})`);
  }
  return (await res.json()) as StreamerResultDetail;
}

/** 방장 — SSE 연결용 단기 1회용 티켓 발급 */
export async function issueSseTicket(sessionId: string, hostToken: string): Promise<{ ticketId: string; expiresInSeconds: number }> {
  const res = await apiFetch(`/api/v1/streamer/sessions/${encodeURIComponent(sessionId)}/ticket`, {
    method: 'POST',
    headers: { 'X-Host-Token': hostToken },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `SSE 티켓 발급 실패 (${res.status})`);
  }
  return (await res.json()) as { ticketId: string; expiresInSeconds: number };
}

/** 단발 status 조회 (방장이 templateId 등 초기 정보 1회 확인용). 폴링은 [pollStreamerStatus] 사용. */
export async function fetchStreamerStatusOnce(sessionId: string): Promise<StreamerStatus | null> {
  const res = await fetch(
    `${PUBLIC_API_BASE_URL}/api/v1/streamer/sessions/${encodeURIComponent(sessionId)}/status`,
    {
      method: 'GET',
      headers: { 'X-Poll-Interval': '10' },
      cache: 'no-store',
      credentials: 'omit',
    },
  );
  if (res.status === 304) return null;
  if (!res.ok) return null;
  return (await res.json()) as StreamerStatus;
}

/** 시청자 — ETag(If-None-Match) + X-Poll-Interval 기반 폴링.
 *  ETag 304 시에는 body 없이 헤더만 처리한다. */
export async function pollStreamerStatus(
  sessionId: string,
  visitorId: string,
  options: { lastVersion: number | null; currentPollInterval: number },
): Promise<PollStatusResult> {
  const headers: HeadersInit = {
    'X-Poll-Interval': String(options.currentPollInterval),
  };
  if (options.lastVersion != null) {
    (headers as Record<string, string>)['If-None-Match'] = `"v${options.lastVersion}"`;
  }
  const q = new URLSearchParams();
  if (visitorId) q.set('visitorId', visitorId);
  const url = `${PUBLIC_API_BASE_URL}/api/v1/streamer/sessions/${encodeURIComponent(sessionId)}/status${q.size ? `?${q.toString()}` : ''}`;
  const res = await fetch(url, { method: 'GET', headers, credentials: 'omit', cache: 'no-store' });
  if (res.status === 304) {
    const nextRaw = res.headers.get('X-Next-Poll-Interval');
    const next = Number(nextRaw);
    return {
      changed: false,
      body: null,
      nextPollIntervalSeconds: Number.isFinite(next) && next > 0 ? next : options.currentPollInterval,
      version: options.lastVersion ?? 0,
    };
  }
  if (!res.ok) {
    throw new Error(`status poll failed (${res.status})`);
  }
  const body = (await res.json()) as StreamerStatus;
  const nextRaw = res.headers.get('X-Next-Poll-Interval');
  const next = Number(nextRaw);
  return {
    changed: true,
    body,
    nextPollIntervalSeconds: Number.isFinite(next) && next > 0 ? next : body.nextPollIntervalSeconds,
    version: body.version,
  };
}

/** 시청자 — 월드컵 매치 투표 */
export async function castWorldcupVote(
  sessionId: string,
  body: { leftId: string; rightId: string; selectedId: string; visitorId: string },
): Promise<{ accepted: boolean; duplicate: boolean; votes: Record<string, number> }> {
  const res = await fetch(
    `${PUBLIC_API_BASE_URL}/api/v1/streamer/sessions/${encodeURIComponent(sessionId)}/vote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `투표 실패 (${res.status})`);
  }
  const row = (await res.json()) as { accepted: boolean; duplicate: boolean; votes: Record<string, number | string> };
  const votes: Record<string, number> = {};
  for (const [k, v] of Object.entries(row.votes ?? {})) {
    const n = typeof v === 'number' ? v : Number(v);
    votes[k] = Number.isFinite(n) ? n : 0;
  }
  return { accepted: !!row.accepted, duplicate: !!row.duplicate, votes };
}

/** 시청자 — 티어표 완성본 제출. placements = 아이템별 배치 행 인덱스(0=최상단). */
export async function submitTier(
  sessionId: string,
  body: { placements: { itemId: string; rowIndex: number }[]; visitorId: string },
): Promise<{ accepted: boolean; duplicate: boolean; totalSubmissions: number }> {
  const res = await fetch(
    `${PUBLIC_API_BASE_URL}/api/v1/streamer/sessions/${encodeURIComponent(sessionId)}/tier-submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(body),
    },
  );
  if (res.status === 409) {
    throw new Error('티어 세션이 아니에요.');
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `제출 실패 (${res.status})`);
  }
  const row = (await res.json()) as {
    accepted: boolean;
    duplicate: boolean;
    totalSubmissions: number | string;
  };
  const total =
    typeof row.totalSubmissions === 'number' ? row.totalSubmissions : Number(row.totalSubmissions);
  return {
    accepted: !!row.accepted,
    duplicate: !!row.duplicate,
    totalSubmissions: Number.isFinite(total) ? total : 0,
  };
}

/** SSE 연결 URL — EventSource에 직접 넘긴다 */
export function sseStreamUrl(sessionId: string, ticketId: string): string {
  return `${PUBLIC_API_BASE_URL}/api/v1/streamer/sessions/${encodeURIComponent(sessionId)}/sse?ticket=${encodeURIComponent(ticketId)}`;
}
