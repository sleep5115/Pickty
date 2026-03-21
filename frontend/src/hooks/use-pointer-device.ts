'use client';

import { useEffect, useState } from 'react';

interface UsePointerDeviceResult {
  /** window.matchMedia('(pointer: fine') 결과. null = hydration 전(SSR) */
  isPointerFine: boolean | null;
}

export function usePointerDevice(): UsePointerDeviceResult {
  // 클라이언트에서는 즉시 matchMedia 결과로 초기화 (SSR에서는 null 유지)
  const [isPointerFine, setIsPointerFine] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.matchMedia('(pointer: fine)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const mql = window.matchMedia('(pointer: fine)');
    setIsPointerFine(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsPointerFine(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return { isPointerFine };
}
