import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SonnerToaster } from "@/components/providers/sonner-toaster";
import { GNB } from "@/components/layout/gnb";
import { SiteMain } from "@/components/layout/site-main";
import { SiteFooter } from "@/components/layout/site-footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  /** 브랜드만 — 특정 도메인(티어·월드컵 등)을 대표 문구로 쓰지 않음 */
  title: "Pickty",
  description: "티어표 만들기 & 이상형 월드컵.",
  icons: {
    icon: [
      {
        url: "/brand/pickty-mark-transparent-128.png",
        type: "image/png",
        sizes: "128x128",
      },
    ],
    apple: [{ url: "/brand/pickty-mark-transparent-128.png", sizes: "128x128" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim();
  const enableGoogleAnalytics =
    process.env.NODE_ENV === "production" && Boolean(gaId);

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <SonnerToaster />
          {/*
           * bg-* 를 div에 지정: ThemeProvider가 html[class="dark"]를 제어하므로
           * dark: 접두사 클래스가 이 div에도 적용됨.
           * min-h-screen: 최소 뷰포트 높이 보장, 티어표처럼 콘텐츠가 길면 페이지 전체 스크롤.
           */}
          <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-200">
            <GNB />
            <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
              <SiteMain>{children}</SiteMain>
            </main>
            <SiteFooter />
          </div>
        </ThemeProvider>
        {enableGoogleAnalytics && gaId ? (
          <GoogleAnalytics gaId={gaId} />
        ) : null}
      </body>
    </html>
  );
}
