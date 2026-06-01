'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useAuthStore } from '@/lib/store/auth-store';
import {
  fetchStreamingResultDetail,
  type StreamerResultDetail,
  type StreamerTierStats,
} from '@/lib/streamer/streamer-api';
import { getTemplate, templatePayloadToTierItems } from '@/lib/tier-api';
import { parseTemplateBoardConfig } from '@/lib/template-board-config';
import {
  StreamerAverageTierView,
  type StreamerAverageTierRow,
} from '@/components/streamer/streamer-average-tier-view';
import type { TierItem } from '@/lib/store/tier-store';

interface ResultSummary {
  tierStats?: Record<string, Record<string, number | string>>;
  tierSubmissions?: number | string;
  boardConfig?: unknown;
}

export default function StreamingResultDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String((params as Record<string, string | string[]>)?.id ?? '');
  const authHydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [detail, setDetail] = useState<StreamerResultDetail | null>(null);
  const [tiers, setTiers] = useState<StreamerAverageTierRow[]>([]);
  const [itemsById, setItemsById] = useState<Map<string, TierItem>>(new Map());
  const [stats, setStats] = useState<StreamerTierStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authHydrated) return;
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const d = await fetchStreamingResultDetail(id);
        if (cancelled) return;
        setDetail(d);

        const summary = (d.summary ?? {}) as ResultSummary;
        const cfg = parseTemplateBoardConfig(summary.boardConfig);
        setTiers(
          (cfg?.rows ?? []).map((r) => ({
            id: r.id,
            label: r.label,
            color: r.color,
            textColor: r.textColor,
          })),
        );

        const tierStats = summary.tierStats ?? {};
        const statItems = Object.entries(tierStats).map(([itemId, dist]) => {
          const distribution: Record<string, number> = {};
          let sample = 0;
          for (const [k, v] of Object.entries(dist)) {
            const n = Number(v) || 0;
            distribution[k] = n;
            sample += n;
          }
          return { itemId, distribution, sampleCount: sample };
        });
        setStats({ totalSubmissions: Number(summary.tierSubmissions) || 0, items: statItems });

        const tpl = await getTemplate(d.templateId, accessToken ?? null).catch(() => null);
        if (cancelled) return;
        const map = new Map<string, TierItem>();
        if (tpl) {
          for (const it of templatePayloadToTierItems(tpl.items)) map.set(it.id, it);
        }
        setItemsById(map);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '불러오기에 실패했어요.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHydrated, accessToken, id, router]);

  if (loading) return <div className="p-8 text-center text-sm text-zinc-500">불러오는 중…</div>;
  if (error) return <div className="p-8 text-center text-sm text-rose-600">{error}</div>;
  if (!detail || detail.templateType !== 'TIER' || !stats) {
    return (
      <div className="p-8 text-center text-sm text-zinc-500">
        이 세션에는 평균 티어표 결과가 없어요.
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-3">
      <div className="mb-2">
        <h1 className="text-lg font-bold">시청자 평균 티어표</h1>
        <p className="text-xs text-zinc-500">
          {formatDate(detail.finishedAt)} 종료 · 시청자 {stats.totalSubmissions}명 제출
        </p>
      </div>
      <StreamerAverageTierView tiers={tiers} itemsById={itemsById} stats={stats} />
    </div>
  );
}

function formatDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
