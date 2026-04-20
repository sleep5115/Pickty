'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, List, MessagesSquare, Trophy } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuthStore } from '@/lib/store/auth-store';
import { useTierStore } from '@/lib/store/tier-store';
import { logoutSession } from '@/lib/auth-session';

const NAV_LINKS = [
  {
    href: '/templates',
    label: '티어 만들기',
    Icon: LayoutGrid,
    isActive: (p: string) => p.startsWith('/templates') || p.startsWith('/template'),
  },
  {
    href: '/tier/feed',
    label: '티어 피드',
    Icon: List,
    isActive: (p: string) => p.startsWith('/tier/feed'),
  },
  {
    href: '/community',
    label: '커뮤니티',
    Icon: MessagesSquare,
    isActive: (p: string) => p.startsWith('/community'),
  },
  {
    href: '/worldcup',
    label: '월드컵',
    Icon: Trophy,
    isActive: (p: string) => p.startsWith('/worldcup'),
  },
] as const;

export function GNB() {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    void (async () => {
      await logoutSession(accessToken);
      logout();
      setMenuOpen(false);
      setAccountOpen(false);
      router.push('/');
    })();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [accountOpen]);

  useEffect(() => {
    startTransition(() => {
      setMenuOpen(false);
      setAccountOpen(false);
    });
  }, [pathname]);

  const accountLinkClass =
    'block w-full text-left text-sm px-3 py-2 rounded-lg text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors';

  return (
    <nav className="relative z-40 w-full shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur-sm transition-colors duration-200 dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 md:px-8">
        <Link
          href="/"
          className="shrink-0 select-none bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-lg font-black text-transparent"
        >
          Pickty
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
          <div
            className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50/90 p-1 shadow-sm shadow-slate-200/40 dark:border-zinc-700 dark:bg-zinc-900/70 dark:shadow-black/20"
            role="navigation"
            aria-label="주요 메뉴"
          >
            {NAV_LINKS.map(({ href, label, Icon, isActive }) => {
              const active = isActive(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-white text-violet-700 shadow-sm ring-1 ring-slate-200/80 dark:bg-zinc-800 dark:text-violet-300 dark:ring-zinc-600'
                      : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <ThemeToggle />
          {accessToken ? (
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => {
                  if (useTierStore.getState().targetTierId !== null) {
                    useTierStore.getState().clearTarget();
                    useTierStore.getState().clearSelection();
                    return;
                  }
                  setAccountOpen((v) => !v);
                }}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className={[
                  'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors',
                  accountOpen
                    ? 'border-violet-400 bg-violet-50 text-slate-900 dark:border-violet-600 dark:bg-violet-950/40 dark:text-zinc-100'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900',
                ].join(' ')}
              >
                내 정보
                <span className="text-[10px] opacity-70" aria-hidden>
                  ▾
                </span>
              </button>
              {accountOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
                >
                  <Link
                    href="/account"
                    role="menuitem"
                    onClick={() => setAccountOpen(false)}
                    className={accountLinkClass}
                  >
                    내 계정
                  </Link>
                  <Link
                    href="/tier/my"
                    role="menuitem"
                    onClick={() => setAccountOpen(false)}
                    className={accountLinkClass}
                  >
                    내 티어표
                  </Link>
                  <Link
                    href="/templates/mine"
                    role="menuitem"
                    onClick={() => setAccountOpen(false)}
                    className={accountLinkClass}
                  >
                    내 템플릿
                  </Link>
                  <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className={`${accountLinkClass} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30`}
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-medium text-white shadow-sm shadow-violet-600/25 transition-colors hover:bg-violet-500 hover:shadow-violet-500/30"
            >
              로그인
            </Link>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 md:hidden" ref={menuRef}>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => {
              if (useTierStore.getState().targetTierId !== null) {
                useTierStore.getState().clearTarget();
                useTierStore.getState().clearSelection();
                return;
              }
              setMenuOpen((v) => !v);
            }}
            aria-label="메뉴 열기"
            className={[
              'flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg transition-colors',
              menuOpen
                ? 'bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100'
                : 'text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60',
            ].join(' ')}
          >
            <span
              className={`block h-0.5 w-4 rounded-full bg-current transition-all duration-200 ${menuOpen ? 'translate-y-2 rotate-45' : ''}`}
            />
            <span
              className={`block h-0.5 w-4 rounded-full bg-current transition-all duration-200 ${menuOpen ? 'scale-x-0 opacity-0' : ''}`}
            />
            <span
              className={`block h-0.5 w-4 rounded-full bg-current transition-all duration-200 ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`}
            />
          </button>

          {menuOpen && (
            <div className="absolute left-0 right-0 top-14 border-b border-slate-200 bg-white/98 shadow-lg backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/98">
              <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-1 px-4 py-2 sm:px-6 md:px-8">
                {NAV_LINKS.map(({ href, label, Icon, isActive }) => {
                  const active = isActive(pathname);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className={[
                        'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                        active
                          ? 'border-violet-200 bg-violet-50 font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300'
                          : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60',
                      ].join(' ')}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                      {label}
                    </Link>
                  );
                })}

                <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />

                {accessToken ? (
                  <>
                    <Link
                      href="/account"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                    >
                      내 계정
                    </Link>
                    <Link
                      href="/tier/my"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                    >
                      내 티어표
                    </Link>
                    <Link
                      href="/templates/mine"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                    >
                      내 템플릿
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-lg px-3 py-2.5 text-left text-sm text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex h-9 items-center justify-center rounded-xl bg-violet-600 text-center text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-500"
                  >
                    로그인
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
