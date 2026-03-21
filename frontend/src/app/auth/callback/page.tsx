'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';

function CallbackHandler() {
  const searchParams = useSearchParams();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (window.opener) {
      // 팝업 흐름 (데스크톱): 부모 창에 토큰 전달 후 팝업 닫기
      if (token) {
        window.opener.postMessage(
          { type: 'OAUTH_SUCCESS', token },
          window.location.origin,
        );
      } else {
        window.opener.postMessage(
          { type: 'OAUTH_ERROR', error: error ?? 'unknown' },
          window.location.origin,
        );
      }
      window.close();
    } else {
      // 직접 리다이렉트 흐름 (모바일 팝업 차단 시)
      if (token) {
        setAccessToken(token);
        window.location.href = '/';
      } else {
        window.location.href = '/login?error=oauth_failed';
      }
    }
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
