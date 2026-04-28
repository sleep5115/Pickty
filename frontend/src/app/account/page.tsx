'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/lib/store/auth-store';
import { logoutSession } from '@/lib/auth-session';
import { apiFetch } from '@/lib/api-fetch';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { uploadPicktyImages } from '@/lib/image-upload-api';
import { onboardingSchema, type OnboardingFormValues } from '@/lib/schemas/auth';
import { PUBLIC_API_BASE_URL } from '@/lib/public-site-config';
import { PICKTY_IMAGE_ACCEPT } from '@/lib/pickty-image-accept';
import { PICKTY_IMAGE_UPLOAD_HINT } from '@/lib/pickty-upload-hint';
import { toast } from 'sonner';

interface UserInfo {
  id: number;
  nickname: string;
  profileImageUrl: string | null;
  role: string;
  providers: string[];
  createdAt: string;
  accountStatus: string;
  gender: string | null;
  birthYear: number | null;
  demoAiEnabled?: boolean;
}

interface SensitiveLinkedAccount {
  provider: string;
  email: string | null;
  name: string | null;
  profileImageUrl: string | null;
}

/** API·Jackson 설정 차이·구형 응답(flat) 호환 */
function parseSensitiveLinkedAccounts(
  raw: unknown,
  defaultProvider: string | undefined,
): SensitiveLinkedAccount[] {
  if (!raw || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  const arr =
    (Array.isArray(o.linkedAccounts) ? o.linkedAccounts : null) ??
    (Array.isArray(o.linked_accounts) ? o.linked_accounts : null);
  if (arr) {
    const out: SensitiveLinkedAccount[] = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const x = item as Record<string, unknown>;
      const pic =
        typeof x.profileImageUrl === 'string'
          ? x.profileImageUrl
          : typeof x.profile_image_url === 'string'
            ? x.profile_image_url
            : null;
      out.push({
        provider: typeof x.provider === 'string' ? x.provider : 'UNKNOWN',
        email: typeof x.email === 'string' ? x.email : null,
        name: typeof x.name === 'string' ? x.name : null,
        profileImageUrl: pic,
      });
    }
    return out;
  }
  if ('email' in o || 'userName' in o || 'oauthProfileImageUrl' in o) {
    return [
      {
        provider: defaultProvider ?? 'GOOGLE',
        email: typeof o.email === 'string' ? o.email : null,
        name: typeof o.userName === 'string' ? o.userName : null,
        profileImageUrl:
          typeof o.oauthProfileImageUrl === 'string' ? o.oauthProfileImageUrl : null,
      },
    ];
  }
  return [];
}

const PROVIDER_STYLE: Record<string, { label: string; className: string }> = {
  GOOGLE: { label: 'Google', className: 'bg-white text-gray-700 border border-gray-300' },
  NAVER: { label: 'Naver', className: 'bg-[#03C75A] text-white' },
  KAKAO: { label: 'Kakao', className: 'bg-[#FEE500] text-black' },
  TWITCH: { label: 'Twitch', className: 'bg-[#9146FF] text-white' },
  CHZZK: { label: '치지직', className: 'bg-[#00FF77] text-black' },
  SOOP: { label: 'SOOP', className: 'bg-[#FF6B35] text-white' },
};

/** 백엔드 `POST /me/oauth-link/challenge` 와 동일한 registrationId */
const OPTIONAL_SOCIAL_LINKS: {
  registrationId: string;
  providerKey: string;
  label: string;
}[] = [
  { registrationId: 'google', providerKey: 'GOOGLE', label: 'Google' },
  { registrationId: 'kakao', providerKey: 'KAKAO', label: '카카오' },
  { registrationId: 'naver', providerKey: 'NAVER', label: '네이버' },
];

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

function genderLabel(g: string | null): string {
  if (g === 'MALE') return '남성';
  if (g === 'FEMALE') return '여성';
  if (g === 'OTHER') return '기타 / 비공개';
  return '—';
}

/** 예: 1999년12월11일 (공백 없음) */
function formatJoinDateKoCompact(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}년${d.getMonth() + 1}월${d.getDate()}일`;
}

function RawAttrValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-500">null</span>;
  }
  if (typeof value === 'boolean') {
    return <span className={value ? 'text-green-400' : 'text-red-400'}>{String(value)}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-amber-400">{String(value)}</span>;
  }
  if (typeof value === 'object') {
    return (
      <span className="text-zinc-400 font-mono text-xs">
        {JSON.stringify(value, null, 2)}
      </span>
    );
  }
  const str = String(value);
  if (str.startsWith('http')) {
    return (
      <a
        href={str}
        target="_blank"
        rel="noopener noreferrer"
        className="text-violet-400 hover:text-violet-300 underline break-all"
      >
        {str}
      </a>
    );
  }
  return <span className="text-zinc-100 break-all">{str}</span>;
}

type ProfileEditModalProps = {
  open: boolean;
  onClose: () => void;
  accessToken: string;
  user: UserInfo;
  onSaved: (u: UserInfo) => void;
  onUnauthorized: () => void;
  isDemoUser: boolean;
};

const DEMO_ACCOUNT_RESTRICTED_MESSAGE = '데모 계정에서는 계정 정보를 변경할 수 없습니다.';

function ProfileEditModal({
  open,
  onClose,
  accessToken,
  user,
  onSaved,
  onUnauthorized,
  isDemoUser,
}: ProfileEditModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const [baselineAvatarUrl, setBaselineAvatarUrl] = useState<string | null>(user.profileImageUrl);
  const [removedAvatar, setRemovedAvatar] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      nickname: user.nickname,
      gender:
        user.gender === 'MALE' || user.gender === 'FEMALE' || user.gender === 'OTHER'
          ? user.gender
          : undefined,
      birthYear: user.birthYear ?? undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    setBaselineAvatarUrl(user.profileImageUrl);
    setAvatarFile(null);
    setRemovedAvatar(false);
    setSaveError(null);
    reset({
      nickname: user.nickname,
      gender:
        user.gender === 'MALE' || user.gender === 'FEMALE' || user.gender === 'OTHER'
          ? user.gender
          : undefined,
      birthYear: user.birthYear ?? undefined,
    });
  }, [open, user, reset]);

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
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const applyFile = useCallback((file: File | null) => {
    setSaveError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSaveError('이미지 파일만 올릴 수 있습니다.');
      return;
    }
    setAvatarFile(file);
    setRemovedAvatar(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setAvatarDragOver(false);
      applyFile(pickImageFile(e.dataTransfer.files));
    },
    [applyFile],
  );

  const onSubmit = async (data: OnboardingFormValues) => {
    if (isDemoUser) {
      toast.info(DEMO_ACCOUNT_RESTRICTED_MESSAGE);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      let displayAvatarUrl: string | null = baselineAvatarUrl;
      if (removedAvatar && !avatarFile) {
        displayAvatarUrl = null;
      }
      if (avatarFile) {
        const urls = await uploadPicktyImages([avatarFile], accessToken);
        displayAvatarUrl = urls[0] ?? null;
      }

      const res = await apiFetch('/api/v1/user/me/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nickname: data.nickname.trim(),
          displayAvatarUrl,
          gender: data.gender,
          birthYear: data.birthYear,
        }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        setSaveError(text || `저장에 실패했습니다. (${res.status})`);
        return;
      }
      const next = (await res.json()) as UserInfo;
      onSaved(next);
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const busy = isSubmitting || saving;
  const circleSrc =
    previewUrl ?? (!removedAvatar && baselineAvatarUrl ? picktyImageDisplaySrc(baselineAvatarUrl) : null);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="profile-edit-title" className="text-lg font-bold text-slate-900 dark:text-zinc-100">
            프로필 변경
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 text-sm"
          >
            닫기
          </button>
        </div>

        {saveError && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-400">
            {saveError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={PICKTY_IMAGE_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                applyFile(pickImageFile(e.target.files));
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
                'w-full rounded-xl border-2 border-dashed px-4 py-6 flex flex-col items-center justify-center cursor-pointer transition-colors',
                avatarDragOver
                  ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/20'
                  : 'border-slate-300 dark:border-zinc-600 bg-slate-50/50 dark:bg-zinc-900/40',
              ].join(' ')}
            >
              {circleSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={circleSrc}
                  alt=""
                  className="w-24 h-24 rounded-full object-cover border border-slate-200 dark:border-zinc-600"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-2xl font-bold text-slate-500 dark:text-zinc-400">
                  {(watch('nickname') || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400 text-center">
                클릭 또는 드래그로 사진 변경
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500 text-center leading-relaxed px-1">
                {PICKTY_IMAGE_UPLOAD_HINT}
              </p>
            </div>
            {(avatarFile || (!removedAvatar && baselineAvatarUrl)) && (
              <button
                type="button"
                onClick={() => {
                  setAvatarFile(null);
                  setRemovedAvatar(true);
                }}
                className="text-xs text-slate-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 underline"
              >
                공개 프로필 사진 제거
              </button>
            )}
          </div>

          <div>
            <label htmlFor="modal-nickname" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              닉네임 <span className="text-red-500">*</span>
            </label>
            <input
              id="modal-nickname"
              type="text"
              autoComplete="username"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              {...register('nickname')}
            />
            {errors.nickname && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.nickname.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="modal-gender" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              성별 <span className="text-slate-400 font-normal">(선택)</span>
            </label>
            <select
              id="modal-gender"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:border-violet-500 cursor-pointer"
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
          </div>

          <div>
            <label htmlFor="modal-birth" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              출생 연도 <span className="text-slate-400 font-normal">(선택)</span>
            </label>
            <select
              id="modal-birth"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:border-violet-500 cursor-pointer"
              value={watch('birthYear') ?? ''}
              onChange={(e) =>
                setValue('birthYear', e.target.value === '' ? undefined : Number(e.target.value), {
                  shouldValidate: true,
                })
              }
            >
              <option value="">선택 안 함</option>
              {BIRTH_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
            >
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const hydrated = useAuthPersistHydrated();
  const { accessToken, clearAuth, setAccessToken } = useAuthStore();
  const [withdrawalCompleted, setWithdrawalCompleted] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  /** 소셜 연동 확인 모달 — 병합·비식별화 안내 후에만 OAuth 진행 */
  const [linkConfirm, setLinkConfirm] = useState<{ registrationId: string; label: string } | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [oauthRaw, setOauthRaw] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [accountInfoOpen, setAccountInfoOpen] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState<SensitiveLinkedAccount[] | null>(null);
  const [sensitiveLoading, setSensitiveLoading] = useState(false);
  const [sensitiveError, setSensitiveError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'OAUTH_SUCCESS') {
        const token = event.data.token as string;
        setAccessToken(token);
        setProfileReloadKey((k) => k + 1);
        setLinkError(null);
      } else if (event.data?.type === 'OAUTH_ERROR') {
        setLinkError('소셜 연동에 실패했습니다. 다시 시도해 주세요.');
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [setAccessToken]);

  useEffect(() => {
    if (!hydrated) return;
    if (withdrawalCompleted) return;
    if (!accessToken) {
      setLoading(false);
      router.replace('/login?returnTo=/account');
      return;
    }

    const headers = { Authorization: `Bearer ${accessToken}` };

    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me', { headers });
        if (res.status === 401) {
          clearAuth();
          router.replace('/login');
          return;
        }
        if (!res.ok) throw new Error(`${res.status}`);
        const userData = (await res.json()) as UserInfo;
        if (userData.accountStatus === 'PENDING') {
          router.replace('/signup/profile');
          return;
        }
        setUser(userData);

        if (userData.role === 'ADMIN') {
          const rawRes = await apiFetch('/api/v1/user/me/oauth-raw', { headers });
          if (rawRes.status === 204) setOauthRaw(null);
          else if (!rawRes.ok) setOauthRaw(null);
          else setOauthRaw((await rawRes.json()) as Record<string, unknown>);
        } else {
          setOauthRaw(null);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg !== '401') setError(`유저 정보를 불러오지 못했습니다. (${msg})`);
      } finally {
        setLoading(false);
      }
    })();
  }, [hydrated, accessToken, router, clearAuth, profileReloadKey, withdrawalCompleted]);

  const startSocialLink = useCallback(
    async (registrationId: string) => {
      if (!accessToken) return;
      setLinkConfirm(null);
      setLinkError(null);
      setLinkBusy(registrationId);
      try {
        const res = await apiFetch('/api/v1/user/me/oauth-link/challenge', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ registrationId }),
        });
        if (res.status === 401) {
          clearAuth();
          router.replace('/login');
          return;
        }
        if (!res.ok) {
          const t = await res.text();
          setLinkError(t || `연동 준비에 실패했습니다. (${res.status})`);
          return;
        }
        const { path } = (await res.json()) as { path: string };
        const url = `${PUBLIC_API_BASE_URL}${path}`;
        const width = 500;
        const height = 620;
        const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
        const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
        const popup = window.open(
          url,
          'pickty-oauth-link',
          `width=${width},height=${height},left=${left},top=${top},popup=1,scrollbars=yes`,
        );
        if (!popup) {
          window.location.href = url;
        } else {
          popup.focus();
        }
      } catch {
        setLinkError('연동 준비 중 오류가 발생했습니다.');
      } finally {
        setLinkBusy(null);
      }
    },
    [accessToken, clearAuth, router],
  );

  useEffect(() => {
    if (!hydrated || !accountInfoOpen || !accessToken || !user) return;
    let cancelled = false;
    setSensitiveLoading(true);
    setSensitiveError(null);
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/user/me/sensitive', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          if (!cancelled) setSensitiveError('계정 정보를 불러오지 못했습니다.');
          return;
        }
        const json: unknown = await res.json();
        if (!cancelled) {
          setLinkedAccounts(parseSensitiveLinkedAccounts(json, user.providers[0]));
        }
      } catch {
        if (!cancelled) setSensitiveError('계정 정보를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setSensitiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, accountInfoOpen, accessToken, user]);

  const linkedSet = useMemo(() => {
    const list = user?.providers;
    if (!list?.length) return new Set<string>();
    return new Set(list.map((p) => p.toUpperCase()));
  }, [user]);

  const handleLogout = () => {
    void (async () => {
      await logoutSession(accessToken);
      clearAuth();
      router.push('/login');
    })();
  };

  const confirmWithdraw = useCallback(async () => {
    if (!accessToken) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await apiFetch('/api/v1/user/me', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      });
      if (!res.ok) {
        const t = await res.text();
        setDeleteError(t || `탈퇴 처리에 실패했습니다. (${res.status})`);
        return;
      }
      setDeleteOpen(false);
      setWithdrawalCompleted(true);
      clearAuth();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : '탈퇴 처리 중 오류가 발생했습니다.');
    } finally {
      setDeleteBusy(false);
    }
  }, [accessToken, clearAuth]);

  if (!hydrated || (!withdrawalCompleted && loading)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400 dark:text-zinc-400">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (withdrawalCompleted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center space-y-8">
          <p className="text-base text-slate-700 dark:text-zinc-200 leading-relaxed">
            탈퇴 처리가 완료되었습니다. <br />
            그동안 이용해 주셔서 감사합니다.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full sm:w-auto min-w-[200px] px-6 py-3 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors"
          >
            메인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 underline"
          >
            로그인 페이지로
          </button>
        </div>
      </div>
    );
  }

  if (!user || !accessToken) return null;

  const isAdmin = user.role === 'ADMIN';
  const isDemoUser = user.demoAiEnabled === true;
  const accountTypeLabel = isAdmin ? '관리자' : '일반 회원';

  const joinDateCompact = formatJoinDateKoCompact(user.createdAt);

  return (
    <div className="w-full py-10 px-1 sm:px-2 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">내 계정</h1>

      <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
        <div className="flex items-start gap-5">
          {user.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 프로필 원형 썸네일
            <img
              src={picktyImageDisplaySrc(user.profileImageUrl)}
              alt=""
              className="w-16 h-16 rounded-full ring-2 ring-violet-500/40 object-cover shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-2xl font-bold text-slate-500 dark:text-zinc-400 shrink-0">
              {user.nickname.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-6 gap-y-1 items-start">
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-zinc-500 mb-0.5">닉네임</p>
              <p className="text-base font-semibold truncate text-slate-900 dark:text-zinc-100">{user.nickname}</p>
              <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 mt-2.5 mb-1.5">연결됨</p>
              <ul className="flex flex-wrap gap-2 min-h-[1.75rem] items-center">
                {user.providers.length === 0 ? (
                  <li className="text-sm text-slate-500 dark:text-zinc-400">아직 없음</li>
                ) : (
                  user.providers.map((p) => {
                    const style = PROVIDER_STYLE[p.toUpperCase()];
                    return (
                      <li
                        key={p}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          style?.className ?? 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200'
                        }`}
                      >
                        {style?.label ?? p}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-zinc-500 mb-0.5">가입일</p>
              <p className="text-base font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">{joinDateCompact}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors self-start sm:self-center"
          >
            변경
          </button>
        </div>
      </div>

      <details
        className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden group"
        onToggle={(e) => {
          const open = e.currentTarget.open;
          setAccountInfoOpen(open);
          if (!open) setLinkedAccounts(null);
        }}
      >
        <summary className="cursor-pointer list-none px-6 py-4 text-sm font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100/80 dark:hover:bg-zinc-800/80 transition-colors flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span>계정 정보</span>
          <span className="text-slate-400 dark:text-zinc-500 text-xs shrink-0 group-open:hidden" aria-hidden>
            펼치기 ▼
          </span>
          <span className="text-slate-400 dark:text-zinc-500 text-xs shrink-0 hidden group-open:inline" aria-hidden>
            접기 ▲
          </span>
        </summary>
        <div className="px-6 pb-6 pt-0 border-t border-slate-200 dark:border-zinc-800 space-y-5 text-sm">
          <p className="text-xs text-slate-500 dark:text-zinc-500 pt-4 leading-relaxed">
            계정 정보는 다른 유저에게 노출되지 않아요
          </p>

          {sensitiveLoading && <p className="text-slate-500 dark:text-zinc-400">불러오는 중…</p>}
          {sensitiveError && <p className="text-red-500 dark:text-red-400">{sensitiveError}</p>}

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-slate-400 dark:text-zinc-500 mb-1">생년</dt>
              <dd className="text-slate-800 dark:text-zinc-200">
                {user.birthYear != null ? `${user.birthYear}년` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 dark:text-zinc-500 mb-1">성별</dt>
              <dd className="text-slate-800 dark:text-zinc-200">{genderLabel(user.gender)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-400 dark:text-zinc-500 mb-1">계정 유형</dt>
              <dd>
                <span
                  className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                    isAdmin
                      ? 'bg-violet-500/20 text-violet-600 dark:text-violet-300'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                  }`}
                >
                  {accountTypeLabel}
                </span>
              </dd>
            </div>
          </dl>

          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 mb-2">연결된 로그인</p>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mb-3 leading-relaxed">
              다른 소셜을 연결하면 <strong className="font-medium text-slate-700 dark:text-zinc-300">가입일이 더 오래된 계정이 본체</strong>가 되고,
              나머지 계정은 병합 처리됩니다. 병합된 쪽은 이메일·이름·프로필 사진 등이 비식별화되며, 이후 계정을 다시 나누는 기능은 제공하지 않습니다.
              연동 전 아래 버튼에서 한 번 더 확인해 주세요.
            </p>
            {linkError && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
                {linkError}
              </div>
            )}
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 mb-2">연동하기</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {OPTIONAL_SOCIAL_LINKS.map((opt) => {
                const connected = linkedSet.has(opt.providerKey);
                if (connected) return null;
                return (
                  <button
                    key={opt.registrationId}
                    type="button"
                    disabled={linkBusy !== null}
                    onClick={() => {
                      if (isDemoUser) {
                        toast.info(DEMO_ACCOUNT_RESTRICTED_MESSAGE);
                        return;
                      }
                      setLinkConfirm({ registrationId: opt.registrationId, label: opt.label });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                  >
                    {linkBusy === opt.registrationId ? `${opt.label} 연결 중…` : `${opt.label} 연동하기`}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-200 dark:border-zinc-800 pt-4 space-y-3">
            {!sensitiveLoading && linkedAccounts && linkedAccounts.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                {user.providers.length > 0
                  ? '표시할 소셜 정보가 없습니다. 한 번 로그아웃 후 다시 로그인해 보세요.'
                  : '연동된 소셜 계정이 없습니다.'}
              </p>
            )}
            {!sensitiveLoading && linkedAccounts && linkedAccounts.length > 0 && (
              <ul className="space-y-3">
                {linkedAccounts.map((acc, idx) => {
                  const style = PROVIDER_STYLE[acc.provider];
                  return (
                    <li
                      key={`${acc.provider}-${idx}`}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40 p-3"
                    >
                      {acc.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={acc.profileImageUrl}
                          alt=""
                          className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-zinc-800 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-zinc-100 truncate">
                          {acc.name?.trim() || '—'}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-zinc-400 truncate break-all">
                          {acc.email ?? '—'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          style?.className ?? 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200'
                        }`}
                      >
                        {style?.label ?? acc.provider}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            </div>
          </div>
        </div>
      </details>

      {isAdmin && (
        <>
          <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
                OAuth 원본 속성 (관리자 전용)
              </h2>
              {oauthRaw ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/20">
                  캐시됨 (30분)
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-700">
                  없음 — 재로그인 시 갱신
                </span>
              )}
            </div>

            {oauthRaw ? (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-slate-400 dark:text-zinc-500 w-1/3">
                      Key
                    </th>
                    <th className="text-left py-2 text-xs font-medium text-slate-400 dark:text-zinc-500">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(oauthRaw).map(([key, value]) => (
                    <tr key={key} className="border-b border-slate-100 dark:border-zinc-800/50 last:border-0">
                      <td className="py-2.5 pr-4 font-mono text-xs text-fuchsia-600 dark:text-fuchsia-400 align-top">
                        {key}
                      </td>
                      <td className="py-2.5 font-mono text-xs align-top">
                        <RawAttrValue value={value} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-400 dark:text-zinc-500">
                캐시된 OAuth 속성이 없습니다. 로그아웃 후 다시 로그인하면 표시될 수 있습니다.
              </p>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Access Token (관리자 전용)</h2>
              <button
                type="button"
                onClick={() => setTokenVisible((v) => !v)}
                className="text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
              >
                {tokenVisible ? '숨기기' : '표시'}
              </button>
            </div>
            {tokenVisible ? (
              <p className="font-mono text-xs text-violet-600 dark:text-violet-300 break-all leading-relaxed">
                {accessToken}
              </p>
            ) : (
              <p className="font-mono text-xs text-slate-300 dark:text-zinc-600">{'•'.repeat(40)}</p>
            )}
          </div>

          <p className="text-xs text-slate-400 dark:text-zinc-600 text-center font-mono">
            내부 사용자 ID: {user.id}
          </p>
        </>
      )}

      <div className="pt-10 mt-2 border-t border-slate-200/80 dark:border-zinc-800 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setDeleteOpen(true);
          }}
          className="text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 underline-offset-2 hover:underline transition-colors"
        >
          회원 탈퇴
        </button>
      </div>

      {linkConfirm && (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="oauth-link-confirm-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && linkBusy === null) setLinkConfirm(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-6 space-y-4">
            <h2 id="oauth-link-confirm-title" className="text-lg font-bold text-slate-900 dark:text-zinc-100">
              {linkConfirm.label} 계정 연동
            </h2>
            <div className="text-sm text-slate-700 dark:text-zinc-200 leading-relaxed space-y-3">
              <p>
                연동에 사용할 <span className="font-medium">{linkConfirm.label}</span> 계정을 로그인 화면에서 직접
                선택·입력하게 됩니다
              </p>
              <p>
                <span className="font-medium">가입일이 더 빠른 계정이 본체</span>로
                남고 나머지는 병합됩니다.<br />
                <span className="font-medium">이후 어느 계정으로든 로그인할 수 있습니다.</span>
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={linkBusy !== null}
                onClick={() => linkBusy === null && setLinkConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={linkBusy !== null}
                onClick={() => void startSocialLink(linkConfirm.registrationId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteBusy) setDeleteOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-6 space-y-4">
            <h2 id="withdraw-dialog-title" className="text-lg font-bold text-slate-900 dark:text-zinc-100">
              회원 탈퇴
            </h2>
            <p className="text-sm text-slate-700 dark:text-zinc-200 leading-relaxed">
              정말 탈퇴하시겠습니까?
            </p>
            <p className="text-sm text-slate-700 dark:text-zinc-200 leading-relaxed">
              탈퇴 시 개인정보가 즉시 파기되므로, 서비스에 게시·작성하신 모든 콘텐츠는 탈퇴 후 수정 및 삭제가 불가능합니다.
              삭제를 원하시면 탈퇴 전 직접 삭제해 주세요.
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              계정·로그인 연동 정보는 복구할 수 없습니다.
            </p>
            {deleteError && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-400">
                {deleteError}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => !deleteBusy && setDeleteOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void confirmWithdraw()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50"
              >
                {deleteBusy ? '처리 중…' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProfileEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        accessToken={accessToken}
        user={user}
        onSaved={setUser}
        onUnauthorized={() => {
          clearAuth();
          router.replace('/login');
        }}
        isDemoUser={isDemoUser}
      />
      </div>
    </div>
  );
}
