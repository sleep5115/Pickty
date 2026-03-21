'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * next-themes는 테마 플래시 방지용 인라인 script를 렌더링함.
 * Next 16 + React 19 콘솔에 경고가 뜰 수 있으나, 동작에는 문제 없음(Recoverable).
 * 업스트림(next-themes) 이슈 추적 권장.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
