'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { apiFetch } from '@/lib/api-fetch';

interface UserInfo {
  id: number;
  email: string | null;
  nickname: string;
  profileImageUrl: string | null;
  role: string;
  providers: string[];
  createdAt: string;
}

const PROVIDER_STYLE: Record<string, { label: string; className: string }> = {
  GOOGLE: { label: 'Google', className: 'bg-white text-gray-700 border border-gray-300' },
  NAVER: { label: 'Naver', className: 'bg-[#03C75A] text-white' },
  KAKAO: { label: 'Kakao', className: 'bg-[#FEE500] text-black' },
  TWITCH: { label: 'Twitch', className: 'bg-[#9146FF] text-white' },
  CHZZK: { label: '치지직', className: 'bg-[#00FF77] text-black' },
  SOOP: { label: 'SOOP', className: 'bg-[#FF6B35] text-white' },
};

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

export default function DashboardPage() {
  const router = useRouter();
  const { accessToken, clearAuth } = useAuthStore();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [oauthRaw, setOauthRaw] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
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
  }, [accessToken, router, clearAuth]);

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400 dark:text-zinc-400">불러오는 중...</p>
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

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';
  const accountTypeLabel = isAdmin ? '관리자' : '일반 회원';

  const createdDate = new Date(user.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="w-full max-w-2xl mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">내 계정</h1>

      <div className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center gap-5">
          {user.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt="프로필"
              className="w-16 h-16 rounded-full ring-2 ring-violet-500/40"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-2xl font-bold text-slate-500 dark:text-zinc-400">
              {user.nickname.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold truncate text-slate-900 dark:text-zinc-100">{user.nickname}</p>
            <p className="text-sm text-slate-500 dark:text-zinc-400 truncate">{user.email ?? '이메일 없음'}</p>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-slate-200 dark:border-zinc-800 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400 dark:text-zinc-500 mb-1">계정 유형</p>
            <span
              className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                isAdmin
                  ? 'bg-violet-500/20 text-violet-600 dark:text-violet-300'
                  : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
              }`}
            >
              {accountTypeLabel}
            </span>
          </div>
          <div>
            <p className="text-slate-400 dark:text-zinc-500 mb-1">가입일</p>
            <p className="text-slate-700 dark:text-zinc-300">{createdDate}</p>
          </div>
          <div className="col-span-2">
            <p className="text-slate-400 dark:text-zinc-500 mb-2">연결된 소셜 계정</p>
            <div className="flex flex-wrap gap-2">
              {user.providers.map((p) => {
                const style = PROVIDER_STYLE[p];
                return (
                  <span
                    key={p}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      style?.className ?? 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200'
                    }`}
                  >
                    {style?.label ?? p}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
