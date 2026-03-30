'use client';

import Link from 'next/link';
import { Download, Link2, MoreVertical, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TierBoardReadonly } from '@/components/tier/tier-board-readonly';
import { TierResultEditMetaModal } from '@/components/tier/tier-result-edit-meta-modal';
import { CommentSection } from '@/components/community/comment-section';
import { ResultVoteButtons } from '@/components/community/result-vote-buttons';
import { TierResultDeleteConfirmDialog } from '@/components/tier/tier-result-delete-confirm-dialog';
import { getTierResult, type TierResultStatus } from '@/lib/tier-api';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthStore } from '@/lib/store/auth-store';
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
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const captureRef = useRef<HTMLDivElement>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [listTitle, setListTitle] = useState<string | null>(null);
  const [listDescription, setListDescription] = useState<string | null>(null);
  const [version, setVersion] = useState(1);
  const [resultUserId, setResultUserId] = useState<number | null>(null);
  const [resultStatus, setResultStatus] = useState<TierResultStatus>('ACTIVE');
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [pool, setPool] = useState<TierItem[]>([]);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: number; role: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [upCount, setUpCount] = useState(0);
  const [downCount, setDownCount] = useState(0);

  const reloadResult = useCallback(async () => {
    if (!id) return;
    const res = await getTierResult(id);
    const snap = parseSnapshot(res.snapshotData as Record<string, unknown>);
    if (!snap) {
      setError('지원하지 않는 스냅샷 형식입니다.');
      throw new Error('unsupported snapshot');
    }
    setError(null);
    setTemplateId(res.templateId);
    setTemplateTitle(res.templateTitle);
    setListTitle(res.listTitle);
    setListDescription(res.listDescription);
    setVersion(res.templateVersion);
    setResultUserId(res.userId ?? null);
    setResultStatus(res.resultStatus ?? 'ACTIVE');
    setUpCount(res.upCount ?? 0);
    setDownCount(res.downCount ?? 0);
    setTiers(snap.tiers);
    setPool(snap.pool);
  }, [id]);

  useEffect(() => {
    if (!accessToken) {
      setMe(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok || cancelled) return;
        const u = (await res.json()) as { id?: unknown; role?: unknown };
        const mid = typeof u.id === 'number' ? u.id : Number(u.id);
        const role = typeof u.role === 'string' ? u.role : '';
        if (Number.isFinite(mid)) {
          setMe({ id: mid, role });
        }
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('잘못된 링크입니다.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await reloadResult();
        if (cancelled) return;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadResult]);

  const isOwner = Boolean(
    me && resultUserId != null && me.id === resultUserId,
  );
  const isResultDeleted = resultStatus === 'DELETED';
  const canDelete = isOwner || me?.role === 'ADMIN';
  const showEdit = isOwner && Boolean(accessToken) && !isResultDeleted;
  const showDelete = canDelete && Boolean(accessToken) && !isResultDeleted;
  const showOwnerMenu = Boolean(accessToken && (showEdit || showDelete));
  const remixHref =
    templateId != null
      ? `/tier?templateId=${encodeURIComponent(templateId)}&sourceResultId=${encodeURIComponent(id)}`
      : null;

  useEffect(() => {
    if (!moreMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreMenuOpen]);

  const copyShareLink = useCallback(async () => {
    if (typeof window === 'undefined' || !id) return;
    const url = `${window.location.origin}/tier/result/${encodeURIComponent(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('공유 링크를 클립보드에 복사했어요.');
    } catch {
      toast.error('복사에 실패했어요. 주소 표시줄의 URL을 직접 복사해 주세요.');
    }
  }, [id]);

  const handleDownloadPng = useCallback(async () => {
    const el = captureRef.current;
    if (!el) return;
    setDownloadError(null);
    setDownloadBusy(true);
    try {
      const url = await captureTierElementToPng(el, 800, { includeWatermark: true });
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
            {isResultDeleted ? ' · 삭제됨(비공개·피드 숨김)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {remixHref && (
            <Link
              href={remixHref}
              className="inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium border border-slate-300 dark:border-zinc-600 text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-colors"
            >
              <RefreshCw className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
              다시 배치하기
            </Link>
          )}
          <button
            type="button"
            onClick={() => void copyShareLink()}
            className={[
              'inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold',
              'border border-slate-300 dark:border-zinc-600 text-slate-800 dark:text-zinc-200',
              'transition-all duration-150 ease-out',
              'hover:bg-slate-50 dark:hover:bg-zinc-800/80',
              'active:scale-[0.98] active:bg-slate-100 dark:active:bg-zinc-700',
            ].join(' ')}
          >
            <Link2 className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            공유
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadPng()}
            disabled={downloadBusy}
            className="inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-lg font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white transition-all duration-150 active:scale-[0.98]"
          >
            <Download className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            {downloadBusy ? '이미지 생성 중…' : '다운로드'}
          </button>
          {showOwnerMenu && (
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setMoreMenuOpen((v) => !v)}
                aria-expanded={moreMenuOpen}
                aria-haspopup="menu"
                aria-label="더 보기"
                className={[
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                  moreMenuOpen
                    ? 'border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/40 text-slate-900 dark:text-zinc-100'
                    : 'border-slate-300 dark:border-zinc-600 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800',
                ].join(' ')}
              >
                <MoreVertical className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
              {moreMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-[100] mt-1 min-w-[10rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
                >
                  {showEdit && (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setEditOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      수정
                    </button>
                  )}
                  {showDelete && (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                      삭제
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {isResultDeleted && (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          이 티어표는 삭제 처리되어 피드에 노출되지 않고 비공개로 전환되었습니다. 링크로는 계속 열어볼 수 있습니다.
        </p>
      )}
      {listDescription?.trim() && (
        <p className="text-sm text-slate-600 dark:text-zinc-400 whitespace-pre-wrap">{listDescription}</p>
      )}
      {!isResultDeleted && id && (
        <ResultVoteButtons
          resultId={id}
          initialUpCount={upCount}
          initialDownCount={downCount}
          onCountsChange={(up, down) => {
            setUpCount(up);
            setDownCount(down);
          }}
        />
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

      {id && (
        <CommentSection
          targetType="TIER_RESULT"
          targetId={id}
          currentUserId={me?.id ?? null}
          onCommentPosted={() => void reloadResult().catch(() => {})}
        />
      )}

      {showEdit && accessToken && (
        <TierResultEditMetaModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          resultId={id}
          accessToken={accessToken}
          initialTitle={listTitle ?? ''}
          initialDescription={listDescription ?? ''}
          onSaved={() => {
            void reloadResult().catch(() => toast.error('갱신에 실패했습니다.'));
            toast.success('저장했어요.');
          }}
        />
      )}
      {showDelete && accessToken && (
        <TierResultDeleteConfirmDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          resultId={id}
          accessToken={accessToken}
          onDeleted={() => {
            void reloadResult()
              .then(() => {
                toast.success('피드에서 숨기고 비공개로 처리했어요.');
              })
              .catch(() => {
                toast.error('갱신에 실패했어요. 내 티어표에서 확인해 주세요.');
                router.replace('/tier/my');
              });
          }}
        />
      )}
    </div>
  );
}
