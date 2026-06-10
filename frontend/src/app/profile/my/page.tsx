'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { getMyProfileSlug } from '@/lib/api/gamer-profile-api';

/** 회원 본인 프로필로 리디렉션. 프로필이 없으면 생성, 비로그인이면 로그인으로. */
export default function GamerProfileMyPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!accessToken) {
        router.replace('/login');
        return;
      }
      const slug = await getMyProfileSlug();
      if (cancelled) return;
      router.replace(slug ? `/profile/${encodeURIComponent(slug)}` : '/profile/create');
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, router]);

  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[var(--bg-base)] text-sm text-[var(--text-secondary)]">
      이동 중…
    </main>
  );
}
