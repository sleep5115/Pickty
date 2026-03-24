'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';

/**
 * `persist`가 localStorage에서 복원되기 전에는 `accessToken`이 잠깐 null이다.
 * 그 상태에서 `/login` 으로내면 새로고침마다 로그인이 풀린 것처럼 보이므로,
 * 보호된 페이지는 이 훅이 true 가 될 때까지 리다이렉트하지 않는다.
 */
export function useAuthPersistHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(useAuthStore.persist.hasHydrated());
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  return hydrated;
}
