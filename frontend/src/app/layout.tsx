import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SonnerToaster } from "@/components/providers/sonner-toaster";
import { GNB } from "@/components/layout/gnb";
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
  // 후순위 미구현 시 description/title에서 월드컵 문구 제외
  title: "Pickty — 티어표 만들기",
  description: "나만의 티어표를 만들고 공유하세요.",
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
            <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4">
              {children}
            </main>
            <SiteFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
