'use client';

import { useEffect, useState } from 'react';
import { useTierStore } from '@/lib/store/tier-store';

/** `persist`가 sessionStorage에서 복원되기 전에는 스냅샷·intent 판단이 어긋날 수 있음 */
export function useTierPersistHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    typeof window === 'undefined' ? false : useTierStore.persist.hasHydrated(),
  );

  useEffect(() => {
    setHydrated(useTierStore.persist.hasHydrated());
    const unsub = useTierStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  return hydrated;
}
