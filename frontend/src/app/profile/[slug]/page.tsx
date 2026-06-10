'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { GamerProfileView } from '@/components/profile/gamer-profile-view';
import { GamerProfileEditor, type EditorSubmitData } from '@/components/profile/gamer-profile-editor';
import { useAuthStore } from '@/lib/store/auth-store';
import {
  getMyProfileSlug,
  getProfile,
  updateProfile,
  verifyProfilePassword,
  type GamerProfile,
} from '@/lib/api/gamer-profile-api';
import { clearEditToken, loadEditToken, saveEditToken } from '@/lib/gamer-profile-edit-token';
import { addProfileHistory } from '@/lib/gamer-profile-history';

export default function GamerProfileDetailPage({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [slug, setSlug] = useState('');
  const [profile, setProfile] = useState<GamerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [isMemberOwner, setIsMemberOwner] = useState(false);

  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // 로드
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(params).then(({ slug: s }) => {
      if (cancelled) return;
      setSlug(s);
      void (async () => {
        try {
          const p = await getProfile(s);
          if (!cancelled) {
            setProfile(p);
            addProfileHistory(p.slug);
          }
        } catch (e) {
          if (!cancelled) {
            if (e instanceof Error && e.message === 'NOT_FOUND') setNotFound(true);
            else toast.error(e instanceof Error ? e.message : '프로필을 불러오지 못했습니다.');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  // 회원 소유 여부: 로그인 + 내 프로필 슬러그 == 현재 슬러그
  useEffect(() => {
    if (!accessToken || !profile || !profile.isMember) {
      setIsMemberOwner(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const mySlug = await getMyProfileSlug();
      if (!cancelled) setIsMemberOwner(mySlug === profile.slug);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, profile]);

  // 편집 진입 가능 힌트(회원 소유 or 비회원 프로필)
  const canEditHint = profile != null && (isMemberOwner || !profile.isMember);

  const enterEdit = useCallback(() => {
    if (!profile) return;
    if (profile.isMember) {
      if (isMemberOwner) setMode('edit');
      else toast.error('본인 프로필만 수정할 수 있습니다.');
      return;
    }
    // 비회원: 이미 받은 토큰이 있으면 바로, 없으면 암구호 모달
    if (loadEditToken(profile.slug)) {
      setMode('edit');
      return;
    }
    setPwd('');
    setPwdError(null);
    setPwdModalOpen(true);
  }, [profile, isMemberOwner]);

  const onVerifyPwd = useCallback(async () => {
    if (!profile) return;
    if (pwd.trim().length < 4) {
      setPwdError('암구호는 4자 이상이에요.');
      return;
    }
    setPwdBusy(true);
    try {
      const { editToken } = await verifyProfilePassword(profile.slug, pwd.trim());
      saveEditToken(profile.slug, editToken);
      setPwdModalOpen(false);
      setMode('edit');
    } catch (e) {
      setPwdError(e instanceof Error ? e.message : '암구호 검증 실패');
    } finally {
      setPwdBusy(false);
    }
  }, [profile, pwd]);

  const onEditSubmit = useCallback(
    async (data: EditorSubmitData) => {
      if (!profile) return;
      const token = isMemberOwner ? null : loadEditToken(profile.slug);
      try {
        const updated = await updateProfile(profile.slug, data, token);
        setProfile(updated);
        setMode('view');
        toast.success('프로필을 저장했어요.');
      } catch (e) {
        // 토큰 만료(403)면 재인증 유도 후 종료(에디터의 중복 토스트 방지)
        if (e instanceof Error && /암구호|403/.test(e.message)) {
          clearEditToken(profile.slug);
          setMode('view');
          toast.error('수정 권한이 만료됐어요. 다시 암구호를 입력해 주세요.');
          return;
        }
        throw e;
      }
    },
    [profile, isMemberOwner],
  );

  if (loading) {
    return (
      <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[var(--bg-base)] text-sm text-[var(--text-secondary)]">
        불러오는 중…
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-4 bg-[var(--bg-base)] px-4 text-center text-[var(--text-primary)]">
        <p className="text-lg font-bold">이 주소의 프로필이 아직 없어요.</p>
        <p className="text-sm text-[var(--text-secondary)]">@{slug}</p>
        <Link
          href="/profile/create"
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
        >
          이 주소로 내 프로필 만들기
        </Link>
      </main>
    );
  }

  if (mode === 'edit') {
    return (
      <main className="min-h-[calc(100dvh-3.5rem)] bg-[var(--bg-base)]">
        <GamerProfileEditor
          mode="edit"
          initial={{
            cards: profile.cards.map((c) => ({
              gameSlug: c.gameSlug,
              gameSource: c.gameSource,
              gameTitle: c.gameTitle,
              gameIconUrl: c.gameIconUrl,
              externalApiIdentifier: c.externalApiIdentifier,
              isMain: c.isMain,
              stats: c.stats,
            })),
            feeds: profile.feeds.map((f) => ({
              imageUrl: f.imageUrl,
              description: f.description,
              feedType: f.feedType,
            })),
          }}
          onSubmit={onEditSubmit}
          submitLabel="저장하기"
        />
        <div className="mx-auto max-w-2xl px-4 pb-10">
          <button
            type="button"
            onClick={() => setMode('view')}
            className="text-sm text-[var(--text-secondary)] underline-offset-2 hover:underline"
          >
            ← 편집 취소하고 돌아가기
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <GamerProfileView profile={profile} canEditHint={canEditHint} onRequestEdit={enterEdit} />

      {pwdModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !pwdBusy && setPwdModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 text-[var(--text-primary)]"
          >
            <h2 className="text-base font-bold">암구호 입력</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              프로필을 만들 때 설정한 암구호를 입력하면 편집할 수 있어요.
            </p>
            <input
              type="password"
              value={pwd}
              autoFocus
              onChange={(e) => {
                setPwd(e.target.value);
                setPwdError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onVerifyPwd();
              }}
              placeholder="암구호"
              className="mt-3 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
            {pwdError ? <p className="mt-1.5 text-xs text-rose-600">{pwdError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPwdModalOpen(false)}
                disabled={pwdBusy}
                className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-base)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void onVerifyPwd()}
                disabled={pwdBusy}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {pwdBusy ? '확인 중…' : '확인'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
