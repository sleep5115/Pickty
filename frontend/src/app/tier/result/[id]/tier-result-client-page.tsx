'use client';

import Link from 'next/link';
import { Download } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TierBoardReadonly } from '@/components/tier/tier-board-readonly';
import { getTierResult } from '@/lib/tier-api';
import { captureTierElementToPng, formatImageCaptureError } from '@/lib/tier-capture-png';
import type { Tier, TierItem } from '@/lib/store/tier-store';

function parseSnapshot(data: Record<string, unknown>): { tiers: Tier[]; pool: TierItem[] } | null {
  if (data.schemaVersion !== 1) return null;
  const tiers = data.tiers;
  const pool = data.pool;
  if (!Array.isArray(tiers) || !Array.isArray(pool)) return null;
  return { tiers: tiers as Tier[], pool: pool as TierItem[] };
}

export function TierResultClientPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const captureRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [listTitle, setListTitle] = useState<string | null>(null);
  const [listDescription, setListDescription] = useState<string | null>(null);
  const [version, setVersion] = useState(1);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [pool, setPool] = useState<TierItem[]>([]);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('잘못된 링크입니다.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getTierResult(id);
        if (cancelled) return;
        const snap = parseSnapshot(res.snapshotData as Record<string, unknown>);
        if (!snap) {
          setError('지원하지 않는 스냅샷 형식입니다.');
          return;
        }
        setTemplateTitle(res.templateTitle);
        setListTitle(res.listTitle);
        setListDescription(res.listDescription);
        setVersion(res.templateVersion);
        setTiers(snap.tiers);
        setPool(snap.pool);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDownloadPng = useCallback(async () => {
    const el = captureRef.current;
    if (!el) return;
    setDownloadError(null);
    setDownloadBusy(true);
    try {
      const url = await captureTierElementToPng(el, 800);
      const a = document.createElement('a');
      a.href = url;
      const base =
        (listTitle?.trim() || 'tier-list').replace(/[/\\?%*:|"<>]/g, '') || 'tier-list';
      a.download = `${base}-${Date.now()}.png`;
      a.click();
    } catch (e) {
      const msg = formatImageCaptureError(e);
      setDownloadError(msg);
      console.error('티어표 캡처 실패:', msg, e);
    } finally {
      setDownloadBusy(false);
    }
  }, [listTitle]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 px-4">
        <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
        <Link href="/templates" className="text-violet-600 dark:text-violet-400 text-sm underline">
          템플릿 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-6 w-full max-w-4xl mx-auto px-1 sm:px-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
            {listTitle?.trim() || '저장된 티어표'}
          </h1>
          <p className="text-xs text-slate-400 dark:text-zinc-600 mt-0.5">
            템플릿: {templateTitle} · v{version}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void handleDownloadPng()}
            disabled={downloadBusy}
            className="inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white transition-colors"
          >
            <Download className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            {downloadBusy ? '이미지 생성 중…' : '다운로드'}
          </button>
          <Link
            href="/tier/my"
            className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            목록
          </Link>
          <Link
            href="/templates"
            className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            템플릿 고르기
          </Link>
        </div>
      </div>
      {listDescription?.trim() && (
        <p className="text-sm text-slate-600 dark:text-zinc-400 whitespace-pre-wrap">{listDescription}</p>
      )}
      {downloadError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          다운로드 실패: {downloadError}
          <span className="block text-xs mt-1 text-slate-500 dark:text-zinc-500">
            다른 도메인 이미지는 서버에서 CORS를 허용해야 캡처됩니다. 새로고침 후 다시 시도해 보세요.
          </span>
        </p>
      )}

      <TierBoardReadonly ref={captureRef} tiers={tiers} pool={pool} />

      <p className="text-xs text-slate-400 dark:text-zinc-600 text-center">
        읽기 전용 · 이 페이지 URL을 공유하면 동일한 배치를 볼 수 있습니다.
      </p>
    </div>
  );
}
