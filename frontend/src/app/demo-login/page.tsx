'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { loginWithDemoAccount } from '@/lib/auth-session';
import { useAuthStore } from '@/lib/store/auth-store';

function DemoLoginHandler() {
  const searchParams = useSearchParams();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  useEffect(() => {
    const returnTo = searchParams.get('returnTo') || '/';

    void (async () => {
      const accessToken = await loginWithDemoAccount();
      if (!accessToken) {
        toast.error('데모 로그인에 실패했습니다.');
        window.location.href = '/login';
        return;
      }

      setAccessToken(accessToken);
      toast.success('데모 계정으로 로그인했습니다.');
      window.location.href = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
    })();
  }, [searchParams, setAccessToken]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      <p className="text-sm text-slate-400 dark:text-zinc-400">데모 계정으로 로그인 중...</p>
    </div>
  );
}

export default function DemoLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400 dark:text-zinc-400">로딩 중...</p>
        </div>
      }
    >
      <DemoLoginHandler />
    </Suspense>
  );
}
