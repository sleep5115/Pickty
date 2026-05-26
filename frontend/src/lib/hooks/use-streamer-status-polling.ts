'use client';

import { useEffect, useRef } from 'react';
import { ensureVisitorId } from '@/lib/streamer/visitor-id';
import { pollStreamerStatus, type StreamerStatus } from '@/lib/streamer/streamer-api';

interface PollingOptions {
  sessionId: string;
  enabled: boolean;
  /** 신선한 status 스냅샷 수신 시 호출 (304일 때는 호출되지 않음) */
  onStatus: (status: StreamerStatus) => void;
  /** 폴링 실패 시 호출 (예: 404 → 세션 종료) */
  onError?: (err: unknown) => void;
}

/**
 * 가변 백오프 폴링 엔진.
 *
 * - If-None-Match: "v{version}" + X-Poll-Interval 헤더 동봉
 * - 응답 헤더 X-Next-Poll-Interval (304/200 모두) 값에 따라 다음 setTimeout 주기 조절
 * - sessionId/visitorId/enabled 변경 시 안전하게 cleanup
 *
 * 의도적으로 setInterval 대신 setTimeout 체이닝 — 응답 도착마다 동적으로 next interval 적용.
 */
export function useStreamerStatusPolling({
  sessionId,
  enabled,
  onStatus,
  onError,
}: PollingOptions): void {
  const onStatusRef = useRef(onStatus);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onStatusRef.current = onStatus;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!enabled || !sessionId) return;
    const visitorId = ensureVisitorId();
    if (!visitorId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastVersion: number | null = null;
    let currentInterval = 3;

    async function tick() {
      if (cancelled) return;
      try {
        const result = await pollStreamerStatus(sessionId, visitorId, {
          lastVersion,
          currentPollInterval: currentInterval,
        });
        if (cancelled) return;
        if (result.changed && result.body) {
          lastVersion = result.body.version;
          onStatusRef.current(result.body);
        } else if (result.version > 0) {
          lastVersion = result.version;
        }
        currentInterval = result.nextPollIntervalSeconds;
      } catch (err) {
        if (cancelled) return;
        onErrorRef.current?.(err);
        // 백오프 — 에러 발생 시에도 폭주 방지를 위해 최소 6초 후 재시도
        currentInterval = Math.max(currentInterval, 6);
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, Math.max(1, currentInterval) * 1000);
        }
      }
    }

    // 즉시 1회 시작
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, enabled]);
}
