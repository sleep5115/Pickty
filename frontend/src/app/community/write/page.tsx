'use client';

import type { JSONContent } from '@tiptap/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { TiptapEditor } from '@/components/community/TiptapEditor';
import { createCommunityPost } from '@/lib/api/community-api';
import { isCommunityBodyHtmlEffectivelyEmpty } from '@/lib/community-body-html';
import { guestNicknamePlainSchema } from '@/lib/schemas/guest-nickname';
import { guestPasswordPlainSchema } from '@/lib/schemas/guest-password';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthStore } from '@/lib/store/auth-store';

const STORAGE_KEY = 'pickty-board-draft';
const STORAGE_LIST_KEY = 'pickty-board-drafts';
const MAX_DRAFTS = 20;

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

type DraftPayload = {
  title: string;
  content: JSONContent;
};

type SavedDraft = DraftPayload & {
  id: string;
  savedAt: string;
};

function parseDraft(raw: string | null): DraftPayload | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<DraftPayload>;
    if (typeof p.title !== 'string' || !p.content || typeof p.content !== 'object') return null;
    return { title: p.title, content: p.content as JSONContent };
  } catch {
    return null;
  }
}

function parseDraftList(raw: string | null): SavedDraft[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((v) => {
        if (!v || typeof v !== 'object') return null;
        const x = v as Partial<SavedDraft>;
        if (
          typeof x.id !== 'string' ||
          typeof x.savedAt !== 'string' ||
          typeof x.title !== 'string' ||
          !x.content ||
          typeof x.content !== 'object'
        ) {
          return null;
        }
        return { id: x.id, savedAt: x.savedAt, title: x.title, content: x.content as JSONContent };
      })
      .filter((v): v is SavedDraft => v !== null);
  } catch {
    return [];
  }
}

function makeDraftId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDraftTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function BoardWritePage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [me, setMe] = useState<{ id: number; nickname: string; profileImageUrl: string | null } | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<JSONContent>(EMPTY_DOC);
  const [contentHtml, setContentHtml] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [guestNickname, setGuestNickname] = useState('');
  const [guestNicknameError, setGuestNicknameError] = useState<string | null>(null);
  const [guestPassword, setGuestPassword] = useState('');
  const [guestPasswordError, setGuestPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isLoggedIn = Boolean(accessToken);

  useEffect(() => {
    if (!accessToken) {
      setMe(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me', { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok || cancelled) return;
        const u = (await res.json()) as { id?: unknown; nickname?: unknown; profileImageUrl?: unknown };
        const id = typeof u.id === 'number' ? u.id : Number(u.id);
        if (!Number.isFinite(id)) return;
        setMe({
          id,
          nickname: typeof u.nickname === 'string' ? u.nickname : '회원',
          profileImageUrl: typeof u.profileImageUrl === 'string' ? u.profileImageUrl : null,
        });
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    const list = parseDraftList(sessionStorage.getItem(STORAGE_LIST_KEY));
    const legacy = parseDraft(sessionStorage.getItem(STORAGE_KEY));

    startTransition(() => {
      if (list.length > 0) {
        setSavedDrafts(list);
      } else if (legacy) {
        const migrated: SavedDraft = {
          id: makeDraftId(),
          savedAt: new Date().toISOString(),
          title: legacy.title,
          content: legacy.content,
        };
        setSavedDrafts([migrated]);
        sessionStorage.setItem(STORAGE_LIST_KEY, JSON.stringify([migrated]));
      }
      sessionStorage.removeItem(STORAGE_KEY);
      setHydrated(true);
    });
  }, []);

  const handleEditorChange = useCallback((json: JSONContent, safeHtml?: string) => {
    setContent(json);
    setContentHtml(safeHtml ?? '');
  }, []);

  const handleSaveDraft = useCallback(() => {
    try {
      const next: SavedDraft = {
        id: makeDraftId(),
        savedAt: new Date().toISOString(),
        title,
        content,
      };
      const updated = [next, ...savedDrafts].slice(0, MAX_DRAFTS);
      setSavedDrafts(updated);
      sessionStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(updated));
      sessionStorage.removeItem(STORAGE_KEY);
      toast.success('임시저장했습니다.');
    } catch {
      toast.error('임시저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.');
    }
  }, [title, content, savedDrafts]);

  const handleLoadDraft = useCallback((draft: SavedDraft) => {
    setTitle(draft.title);
    setContent(draft.content);
    setLoadModalOpen(false);
    toast.success('임시저장 글을 불러왔습니다.');
  }, []);

  const handleDeleteDraft = useCallback((id: string) => {
    const updated = savedDrafts.filter((d) => d.id !== id);
    setSavedDrafts(updated);
    sessionStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(updated));
  }, [savedDrafts]);

  const handleCancel = useCallback(() => {
    router.push('/community');
  }, [router]);

  const handleSubmit = useCallback(async () => {
    let guestPwdPayload: string | undefined;
    let guestNickTrimmed: string | undefined;

    if (!isLoggedIn) {
      const nickRes = guestNicknamePlainSchema.safeParse(guestNickname);
      if (!nickRes.success) {
        setGuestNicknameError(nickRes.error.issues[0]?.message ?? null);
      } else {
        setGuestNicknameError(null);
      }
      const pwdRes = guestPasswordPlainSchema.safeParse(guestPassword);
      if (!pwdRes.success) {
        setGuestPasswordError(pwdRes.error.issues[0]?.message ?? null);
      } else {
        setGuestPasswordError(null);
      }
      if (!nickRes.success || !pwdRes.success) return;
      guestNickTrimmed = nickRes.data;
      guestPwdPayload = pwdRes.data;
    } else {
      setGuestNicknameError(null);
      setGuestPasswordError(null);
    }

    const t = title.trim();
    if (!t) {
      toast.error('제목을 입력해 주세요.');
      return;
    }
    if (isCommunityBodyHtmlEffectivelyEmpty(contentHtml)) {
      toast.error('본문을 입력해 주세요.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await createCommunityPost({
        title: t,
        contentHtml,
        guestNickname: isLoggedIn ? undefined : guestNickTrimmed,
        guestPassword: guestPwdPayload,
      });
      toast.success('게시글을 등록했습니다.');
      router.push('/community');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '게시글 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [title, contentHtml, isLoggedIn, guestNickname, guestPassword, submitting, router]);

  const savedCount = savedDrafts.length;
  const canOpenLoad = savedCount > 0;
  const loadLabel = useMemo(() => `불러오기(${savedCount})`, [savedCount]);

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] w-full bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="flex w-full min-w-0 flex-col gap-5 py-8">
        <nav className="text-sm text-[var(--text-secondary)]">
          <Link href="/community" className="hover:text-[var(--text-primary)]">
            커뮤니티
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-[var(--text-primary)]">글쓰기</span>
        </nav>

        {isLoggedIn ? (
          <p className="flex flex-wrap items-baseline gap-x-2 border-b border-[var(--border-subtle)] pb-2.5 text-xs text-[var(--text-secondary)]">
            <span className="shrink-0">작성자</span>
            <span className="text-[var(--border-subtle)]" aria-hidden>
              ·
            </span>
            <span className="font-medium text-[var(--text-primary)]">{me?.nickname ?? '회원'}</span>
          </p>
        ) : (
          <div className="border-b border-[var(--border-subtle)] pb-2.5">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">비회원</p>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-[var(--text-secondary)]">
                  닉네임<span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  value={guestNickname}
                  onChange={(e) => {
                    setGuestNickname(e.target.value);
                    setGuestNicknameError(null);
                  }}
                  maxLength={10}
                  placeholder="2~10자"
                  aria-invalid={guestNicknameError ? true : undefined}
                  className="h-8 w-[9.5rem] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-[13px] outline-none transition focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/30"
                />
                <p
                  className={`min-h-[1.25rem] text-[11px] leading-tight ${guestNicknameError ? 'text-rose-600 dark:text-rose-400' : 'text-transparent'}`}
                  aria-live="polite"
                >
                  {guestNicknameError ?? '\u00a0'}
                </p>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-[var(--text-secondary)]">
                  비밀번호<span className="text-rose-500">*</span>
                </span>
                <input
                  type="password"
                  value={guestPassword}
                  onChange={(e) => {
                    setGuestPassword(e.target.value);
                    setGuestPasswordError(null);
                  }}
                  maxLength={128}
                  aria-invalid={guestPasswordError ? true : undefined}
                  placeholder="4자 이상"
                  className="h-8 w-[9.5rem] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-[13px] outline-none transition focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400/30"
                />
                <p
                  className={`min-h-[1.25rem] text-[11px] leading-tight ${guestPasswordError ? 'text-rose-600 dark:text-rose-400' : 'text-transparent'}`}
                  aria-live="polite"
                >
                  {guestPasswordError ?? '\u00a0'}
                </p>
              </label>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="community-write-title" className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
            제목
          </label>
          <input
            id="community-write-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            maxLength={200}
            className="h-12 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 text-base font-semibold text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-[var(--text-secondary)] placeholder:font-normal focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/25 sm:h-11 sm:text-lg"
          />
        </div>

        {hydrated ? (
          <TiptapEditor
            accessToken={accessToken}
            content={content}
            onChange={handleEditorChange}
            placeholder="내용을 작성해 보세요. 이미지는 복붙·드래그로도 넣을 수 있어요."
            className="w-full min-w-0"
          />
        ) : (
          <div className="flex min-h-[540px] w-full min-w-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-secondary)]">
            에디터 불러오는 중…
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="h-11 rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-5 text-sm font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100 dark:border-fuchsia-700/60 dark:bg-fuchsia-950/30 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900/30"
          >
            임시저장
          </button>
          <button
            type="button"
            onClick={() => setLoadModalOpen(true)}
            disabled={!canOpenLoad}
            className="h-11 rounded-xl border border-violet-300 bg-violet-50 px-5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-violet-700/60 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/30"
          >
            {loadLabel}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-base)]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="h-11 rounded-xl bg-linear-to-r from-violet-600 to-fuchsia-600 px-6 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition hover:from-violet-500 hover:to-fuchsia-500"
          >
            {submitting ? '등록 중…' : '등록'}
          </button>
        </div>
      </div>

      {loadModalOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-load-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLoadModalOpen(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="draft-load-title" className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                임시저장 글 불러오기
              </h2>
              <button
                type="button"
                className="text-sm text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                onClick={() => setLoadModalOpen(false)}
              >
                닫기
              </button>
            </div>

            {savedDrafts.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500 dark:text-zinc-400">저장된 임시글이 없습니다.</p>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-zinc-800 dark:border-zinc-700">
                {savedDrafts.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => handleLoadDraft(d)}
                      className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-zinc-800"
                    >
                      <div className="truncate text-sm font-medium text-slate-800 dark:text-zinc-100">
                        {d.title.trim() || '(제목 없음)'}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{formatDraftTime(d.savedAt)}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDraft(d.id)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
