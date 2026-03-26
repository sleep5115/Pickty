'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { resolvePostLoginRoute } from '@/lib/post-login-route';
import { exchangeOAuthCode } from '@/lib/auth-session';

function CallbackHandler() {
  const searchParams = useSearchParams();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  useEffect(() => {
    const exchange = searchParams.get('exchange');
    const error = searchParams.get('error');

    void (async () => {
      if (window.opener) {
        if (exchange) {
          const accessToken = await exchangeOAuthCode(exchange);
          if (accessToken) {
            window.opener.postMessage(
              { type: 'OAUTH_SUCCESS', token: accessToken },
              window.location.origin,
            );
          } else {
            window.opener.postMessage(
              { type: 'OAUTH_ERROR', error: error ?? 'exchange_failed' },
              window.location.origin,
            );
          }
        } else {
          window.opener.postMessage(
            { type: 'OAUTH_ERROR', error: error ?? 'unknown' },
            window.location.origin,
          );
        }
        window.close();
        return;
      }

      if (exchange) {
        const accessToken = await exchangeOAuthCode(exchange);
        if (accessToken) {
          setAccessToken(accessToken);
          const path = await resolvePostLoginRoute(null);
          window.location.href = path;
        } else {
          window.location.href = '/login?error=oauth_failed';
        }
      } else {
        window.location.href = '/login?error=oauth_failed';
      }
    })();
  }, [searchParams, setAccessToken]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      <p className="text-sm text-slate-400 dark:text-zinc-400">인증 처리 중...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400 dark:text-zinc-400">로딩 중...</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
