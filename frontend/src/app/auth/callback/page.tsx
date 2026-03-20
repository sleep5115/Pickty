'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function CallbackHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (window.opener) {
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
      // 팝업이 아닌 경우 (팝업 차단 후 리다이렉트 fallback)
      window.location.href = token ? '/dashboard' : '/login?error=oauth_failed';
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      <p className="text-sm text-zinc-400">인증 처리 중...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-sm text-zinc-400">로딩 중...</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
