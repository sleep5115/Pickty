'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { onboardingSchema, type OnboardingFormValues } from '@/lib/schemas/auth';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useAuthStore } from '@/lib/store/auth-store';
import { apiFetch } from '@/lib/api-fetch';
import { uploadPicktyImages } from '@/lib/image-upload-api';
import { generateRandomPlayfulNickname } from '@/lib/nickname-playful';
import { runPersistedTierAutoSave } from '@/lib/post-oauth-tier-flow';
import { toast } from 'sonner';
import { PICKTY_IMAGE_ACCEPT } from '@/lib/pickty-image-accept';

const BIRTH_YEAR_OPTIONS = (() => {
  const y = new Date().getFullYear();
  const list: number[] = [];
  for (let i = y; i >= 1900; i--) list.push(i);
  return list;
})();

function pickImageFile(list: FileList | File[] | null): File | null {
  if (!list || list.length === 0) return null;
  const arr = Array.from(list);
  const f = arr.find((x) => x.type.startsWith('image/'));
  return f ?? null;
}

export default function OnboardingProfilePage() {
  const router = useRouter();
  const hydrated = useAuthPersistHydrated();
  const { accessToken, clearAuth } = useAuthStore();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      nickname: '',
      gender: undefined,
      birthYear: undefined,
    },
  });

  const previewUrl = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : null),
    [avatarFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) {
      setChecking(false);
      router.replace('/login');
      return;
    }

    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.status === 401) {
          clearAuth();
          router.replace('/login');
          return;
        }
        if (!res.ok) {
          setLoadError('프로필 정보를 불러오지 못했습니다.');
          return;
        }
        const me = (await res.json()) as {
          accountStatus: string;
          nickname: string;
          gender: string | null;
          birthYear: number | null;
        };
        if (me.accountStatus !== 'PENDING') {
          router.replace('/account');
          return;
        }
        setValue('nickname', me.nickname ?? '');
        if (me.gender === 'MALE' || me.gender === 'FEMALE' || me.gender === 'OTHER') {
          setValue('gender', me.gender);
        }
        if (me.birthYear != null) setValue('birthYear', me.birthYear);
      } catch {
        setLoadError('프로필 정보를 불러오지 못했습니다.');
      } finally {
        setChecking(false);
      }
    })();
  }, [hydrated, accessToken, router, clearAuth, setValue]);

  const applyFile = useCallback((file: File | null) => {
    setLoadError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLoadError('이미지 파일만 올릴 수 있습니다.');
      return;
    }
    setAvatarFile(file);
    setPhotoOpen(true);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setAvatarDragOver(false);
      const file = pickImageFile(e.dataTransfer.files);
      applyFile(file);
    },
    [applyFile],
  );

  const onSubmit = async (data: OnboardingFormValues) => {
    if (!accessToken) return;
    setLoadError(null);
    setSaving(true);
    try {
      let displayAvatarUrl: string | undefined;
      if (avatarFile) {
        try {
          const urls = await uploadPicktyImages([avatarFile], accessToken);
          displayAvatarUrl = urls[0];
        } catch (e) {
          const msg = e instanceof Error ? e.message : '이미지 업로드에 실패했습니다.';
          setLoadError(msg);
          setSaving(false);
          return;
        }
      }

      const body: Record<string, unknown> = {
        nickname: data.nickname.trim(),
        displayAvatarUrl: displayAvatarUrl ?? undefined,
        gender: data.gender,
        birthYear: data.birthYear,
      };

      const res = await apiFetch('/api/v1/user/me/onboarding', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        clearAuth();
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        setLoadError(text || `저장에 실패했습니다. (${res.status})`);
        return;
      }

      const autoSave = await runPersistedTierAutoSave(accessToken);
      if (autoSave.ok) {
        router.replace(`/tier/result/${autoSave.resultId}`);
        return;
      }
      if (autoSave.reason === 'error' && autoSave.message) {
        toast.error(autoSave.message);
      }
      router.replace('/account');
    } finally {
      setSaving(false);
    }
  };

  const busy = isSubmitting || saving;

  if (!hydrated || checking) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500 dark:text-zinc-400">불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-4xl font-black tracking-tight bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
              Pickty
            </span>
          </Link>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">환영합니다</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-xl shadow-black/10 dark:shadow-black/50">
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-1">닉네임을 정해 주세요</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">언제든지 변경 가능해요.</p>

          {loadError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-400">
              {loadError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                닉네임 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="nickname"
                  type="text"
                  autoComplete="username"
                  placeholder="2~20자 활동명"
                  className="min-w-0 flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors"
                  {...register('nickname')}
                />
                <button
                  type="button"
                  onClick={() =>
                    setValue('nickname', generateRandomPlayfulNickname(), {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  className="shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-zinc-600 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors"
                  title="랜덤 닉네임"
                  aria-label="랜덤 닉네임 생성"
                >
                  🔄
                </button>
              </div>
              {errors.nickname && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.nickname.message}</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setPhotoOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-zinc-200 bg-slate-50/80 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                aria-expanded={photoOpen}
              >
                <span>프로필 사진 등록하기 (선택)</span>
                <span
                  className={`text-slate-400 dark:text-zinc-500 transition-transform shrink-0 ${photoOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                >
                  ▼
                </span>
              </button>
              {photoOpen && (
                <div className="p-4 border-t border-slate-200 dark:border-zinc-700 space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={PICKTY_IMAGE_ACCEPT}
                    className="sr-only"
                    onChange={(e) => {
                      const file = pickImageFile(e.target.files);
                      applyFile(file);
                      e.target.value = '';
                    }}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setAvatarDragOver(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setAvatarDragOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setAvatarDragOver(false);
                    }}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={[
                      'rounded-xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors',
                      avatarDragOver
                        ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20'
                        : 'border-slate-300 dark:border-zinc-600 bg-slate-50/50 dark:bg-zinc-900/40 hover:border-slate-400 dark:hover:border-zinc-500',
                    ].join(' ')}
                  >
                    {previewUrl ? (
                      <div className="flex flex-col items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt=""
                          className="w-24 h-24 rounded-full object-cover border border-slate-200 dark:border-zinc-600"
                        />
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          클릭하여 다른 사진으로 바꾸거나, 여기로 드래그하세요.
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-slate-600 dark:text-zinc-300 mb-1">
                          클릭하거나 이미지를 여기에 놓으세요
                        </p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500">JPG, PNG, WebP, GIF</p>
                      </>
                    )}
                  </div>
                  {avatarFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAvatarFile(null);
                      }}
                      className="text-xs text-slate-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 underline"
                    >
                      선택한 사진 제거
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                성별 <span className="text-slate-400 font-normal">(선택)</span>
              </label>
              <select
                id="gender"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors cursor-pointer"
                value={watch('gender') ?? ''}
                onChange={(e) =>
                  setValue('gender', e.target.value === '' ? undefined : (e.target.value as 'MALE' | 'FEMALE' | 'OTHER'), {
                    shouldValidate: true,
                  })
                }
              >
                <option value="">선택 안 함</option>
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
                <option value="OTHER">기타 / 비공개</option>
              </select>
              {errors.gender && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.gender.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="birthYear" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                출생 연도 <span className="text-slate-400 font-normal">(선택)</span>
              </label>
              <select
                id="birthYear"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors cursor-pointer"
                value={watch('birthYear') ?? ''}
                onChange={(e) =>
                  setValue(
                    'birthYear',
                    e.target.value === '' ? undefined : Number(e.target.value),
                    { shouldValidate: true },
                  )
                }
              >
                <option value="">선택 안 함</option>
                {BIRTH_YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              {errors.birthYear && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.birthYear.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-white bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer mt-2"
            >
              {busy ? '저장 중...' : '시작하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
