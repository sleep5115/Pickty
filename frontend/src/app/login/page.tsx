'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormValues } from '@/lib/schemas/auth';
import { PUBLIC_API_BASE_URL } from '@/lib/public-site-config';
import { resolvePostLoginRoute } from '@/lib/post-login-route';

/**
 * 소셜 로그인: 브라우저가 `${PUBLIC_API_BASE_URL}/oauth2/authorization/{provider}` 로 이동(팝업 또는 전체 탭).
 * 성공 시 백엔드가 Refresh(HttpOnly 쿠키) 설정 후 `{허용된 프론트 오리진}/auth/callback?exchange=...` 로 리다이렉트.
 * 프론트는 `POST /api/v1/auth/oauth-exchange`(credentials)로 Access JSON 수령.
 *
 * Google Cloud Console → 승인된 리디렉션 URI (백엔드 호스트, 복사용):
 *   https://api.pickty.app/login/oauth2/code/google
 *   http://localhost:8080/login/oauth2/code/google
 *
 * 네이버 개발자 센터 → Callback URL:
 *   https://api.pickty.app/login/oauth2/code/naver
 *   http://localhost:8080/login/oauth2/code/naver
 */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="white">
      <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="#3C1E1E">
      <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.717 1.638 5.1 4.12 6.54l-1.05 3.906c-.09.336.29.596.572.4L10.04 19.2c.63.09 1.28.14 1.96.14 5.523 0 10-3.477 10-7.8S17.523 3 12 3z" />
    </svg>
  );
}

function TwitchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="white">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const API_URL = PUBLIC_API_BASE_URL;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAccessToken } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'OAUTH_SUCCESS') {
        const token = event.data.token as string;
        setAccessToken(token);
        void resolvePostLoginRoute(searchParams.get('returnTo')).then((path) => {
          router.push(path);
        });
      } else if (event.data?.type === 'OAUTH_ERROR') {
        setSocialError('소셜 로그인에 실패했습니다. 다시 시도해 주세요.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router, searchParams, setAccessToken]);

  const onSubmit = async (data: LoginFormValues) => {
    // TODO: 자체 로그인 API 연동
    console.log('login:', data);
  };

  const handleComingSoonSocial = () => {
    window.alert('준비 중입니다');
  };

  const handleSocialLogin = (provider: string) => {
    setSocialError(null);

    const width = 500;
    const height = 620;
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);

    const popup = window.open(
      `${API_URL}/oauth2/authorization/${provider}`,
      'pickty-oauth',
      `width=${width},height=${height},left=${left},top=${top},popup=1,scrollbars=yes`,
    );

    if (!popup) {
      // 팝업이 차단된 경우 현재 탭에서 리다이렉트
      window.location.href = `${API_URL}/oauth2/authorization/${provider}`;
    } else {
      popup.focus();
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-4xl font-black tracking-tight bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
              Pickty
            </span>
          </Link>
          {/* 후순위 미구현: 월드컵 문구 숨김 */}
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">티어표 만들기</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-xl shadow-black/10 dark:shadow-black/50">
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-6">로그인</h1>

          {socialError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-500 dark:text-red-400">
              {socialError}
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                이메일
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="example@email.com"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors"
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="비밀번호를 입력하세요"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 transition-colors"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-white bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-800" />
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">또는</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-800" />
          </div>

          {/* Wide Social Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-slate-200 text-gray-700 font-medium text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <GoogleIcon />
              <span className="flex-1 text-center">Google로 계속하기</span>
            </button>

            <button
              type="button"
              onClick={() => handleSocialLogin('naver')}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              style={{ backgroundColor: '#03C75A' }}
            >
              <NaverIcon />
              <span className="flex-1 text-center">네이버로 계속하기</span>
            </button>

            <button
              type="button"
              onClick={() => handleSocialLogin('kakao')}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              style={{ backgroundColor: '#FEE500', color: '#000000' }}
            >
              <KakaoIcon />
              <span className="flex-1 text-center">카카오로 계속하기</span>
            </button>
          </div>

          {/* Circular Social Buttons */}
          <div className="mt-5 flex items-center justify-center gap-4">
            <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-800" />
            <div className="flex gap-3">
              <button
                type="button"
                aria-label="Twitch로 로그인"
                onClick={handleComingSoonSocial}
                className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                style={{ backgroundColor: '#9146FF' }}
              >
                <TwitchIcon />
              </button>

              <button
                type="button"
                aria-label="치지직으로 로그인"
                onClick={handleComingSoonSocial}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 overflow-hidden transition-all duration-200 hover:scale-110 hover:border-[#00FF77] active:scale-95 cursor-pointer"
              >
                <span className="text-xs font-black text-[#00FF77]">치직</span>
              </button>

              <button
                type="button"
                aria-label="SOOP으로 로그인"
                onClick={handleComingSoonSocial}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-sm transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                style={{ backgroundColor: '#FF6B35' }}
              >
                S
              </button>
            </div>
            <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginSuspenseFallback() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSuspenseFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
