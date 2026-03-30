'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { TemplateEditMetaModal } from '@/components/template/template-edit-meta-modal';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { listTemplates, type TemplateSummaryResponse } from '@/lib/tier-api';
import { TemplateDeleteConfirmDialog } from '@/components/template/template-delete-confirm-dialog';
import { TemplateLikeButton } from '@/components/community/template-like-button';

function TemplateCard({
  row,
  currentUserId,
  isAdmin,
  accessToken,
  onEdit,
  onDelete,
  onLikeCountChange,
}: {
  row: TemplateSummaryResponse;
  currentUserId: number | null;
  isAdmin: boolean;
  accessToken: string | null;
  onEdit: (t: TemplateSummaryResponse) => void;
  onDelete: (t: TemplateSummaryResponse) => void;
  onLikeCountChange: (templateId: string, likeCount: number) => void;
}) {
  const { id, title, description, thumbnailUrl, itemCount, creatorId } = row;
  const descTrimmed = description?.trim() ? description.trim() : null;
  const itemLine = `아이템 ${itemCount}개`;
  const hasThumb = Boolean(thumbnailUrl);
  const isOwner =
    currentUserId != null && creatorId != null && currentUserId === creatorId;
  const showEdit = Boolean(accessToken && (isOwner || isAdmin));
  const showDelete = Boolean(accessToken && (isOwner || isAdmin));
  const showMenu = Boolean(accessToken && (showEdit || showDelete));

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Link
        href={`/tier?templateId=${encodeURIComponent(id)}`}
        className="group flex w-full flex-col transition-colors"
      >
        <div
          className="relative w-full shrink-0 overflow-hidden rounded-t-xl border-b border-slate-100 bg-linear-to-br from-slate-200 to-slate-100 dark:border-zinc-800 dark:from-zinc-800 dark:to-zinc-900"
          style={{ aspectRatio: '16 / 10', minHeight: '120px' }}
        >
          {hasThumb ? (
            <div className="absolute inset-0 min-h-0 w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={picktyImageDisplaySrc(thumbnailUrl!)}
                alt=""
                className="block h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : (
            <div className="flex h-full min-h-[120px] items-center justify-center">
              <span
                className="select-none text-4xl opacity-40 transition-opacity group-hover:opacity-60"
                aria-hidden
              >
                ◆
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 px-3 py-2.5">
          <span className="line-clamp-1 min-w-0 font-semibold text-slate-900 transition-colors group-hover:text-violet-700 dark:text-zinc-100 dark:group-hover:text-violet-300">
            {title}
          </span>
          <div className="mt-1 min-h-[calc(2*0.875rem*1.375)] text-sm leading-snug">
            <p
              className={
                descTrimmed
                  ? 'line-clamp-2 text-slate-600 dark:text-zinc-400'
                  : 'line-clamp-2 text-slate-500 dark:text-zinc-500'
              }
            >
              {descTrimmed ?? '설명 없음'}
            </p>
          </div>
        </div>
      </Link>
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-3 dark:border-zinc-800/80 rounded-b-xl">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 truncate text-xs leading-none text-slate-500 dark:text-zinc-500">{itemLine}</span>
          <TemplateLikeButton
            templateId={id}
            initialLikeCount={row.likeCount ?? 0}
            onLikeCountChange={(n) => onLikeCountChange(id, n)}
            className="shrink-0"
          />
        </div>
        {showMenu ? (
          <div className="relative flex shrink-0 items-center justify-center" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="더 보기"
              className={[
                'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                menuOpen
                  ? 'border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/40 text-slate-900 dark:text-zinc-100'
                  : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800',
              ].join(' ')}
            >
              <MoreVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-[100] mt-1 min-w-[9.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
              >
                {showEdit && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(row);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    수정
                  </button>
                )}
                {showDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(row);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    삭제
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const hydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<TemplateSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: number; role: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateSummaryResponse | null>(null);
  const [editMetaTarget, setEditMetaTarget] = useState<TemplateSummaryResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!hydrated || !accessToken) {
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
  }, [hydrated, accessToken]);

  return (
    <div className="flex w-full flex-col gap-8 px-1 py-8 sm:px-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            티어 템플릿
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            템플릿을 고르면 바로 티어표를 만들어 볼 수 있어요.
          </p>
        </div>
        <Link
          href={accessToken ? '/template/new' : '/login?returnTo=/template/new'}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-violet-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/25 transition-colors hover:bg-violet-500 dark:bg-violet-600 dark:shadow-violet-900/30 dark:hover:bg-violet-500"
        >
          새 템플릿 만들기
        </Link>
      </div>

      <section aria-labelledby="templates-real-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="templates-real-heading" className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
            등록된 템플릿
          </h2>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="text-xs font-medium text-violet-600 hover:underline disabled:opacity-50 dark:text-violet-400"
          >
            새로고침
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="py-6 text-sm text-slate-600 dark:text-zinc-400">
            아직 등록된 템플릿이 없습니다. 상단의 <strong>새 템플릿 만들기</strong>로 첫 티어표를 만들어 보세요.
          </p>
        )}

        {!loading && !error && rows.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((t) => (
              <TemplateCard
                key={t.id}
                row={t}
                currentUserId={me?.id ?? null}
                isAdmin={me?.role === 'ADMIN'}
                accessToken={accessToken}
                onLikeCountChange={(templateId, likeCount) => {
                  setRows((prev) =>
                    prev.map((r) => (r.id === templateId ? { ...r, likeCount } : r)),
                  );
                }}
                onEdit={(target) => {
                  if (!accessToken) {
                    router.push('/login?returnTo=/templates');
                    return;
                  }
                  setEditMetaTarget(target);
                }}
                onDelete={(target) => {
                  if (!accessToken) {
                    router.push('/login?returnTo=/templates');
                    return;
                  }
                  setDeleteTarget(target);
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {accessToken && editMetaTarget && (
        <TemplateEditMetaModal
          open
          onClose={() => setEditMetaTarget(null)}
          templateId={editMetaTarget.id}
          accessToken={accessToken}
          initialTitle={editMetaTarget.title}
          initialDescription={editMetaTarget.description ?? ''}
          onSaved={(u) => {
            setRows((prev) =>
              prev.map((r) =>
                r.id === u.id
                  ? { ...r, title: u.title, description: u.description, version: u.version }
                  : r,
              ),
            );
            toast.success('저장했어요.');
          }}
        />
      )}

      {accessToken && deleteTarget && (
        <TemplateDeleteConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          templateId={deleteTarget.id}
          accessToken={accessToken}
          onDeleted={() => {
            void load();
            toast.success('삭제했어요.');
          }}
        />
      )}
    </div>
  );
}
