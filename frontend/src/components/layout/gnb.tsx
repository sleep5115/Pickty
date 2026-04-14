'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, List, MessagesSquare } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuthStore } from '@/lib/store/auth-store';
import { useTierStore } from '@/lib/store/tier-store';
import { logoutSession } from '@/lib/auth-session';

const NAV_LINKS = [
  {
    href: '/templates',
    label: '템플릿',
    Icon: LayoutGrid,
    isActive: (p: string) => p.startsWith('/templates') || p.startsWith('/template'),
  },
  {
    href: '/tier/feed',
    label: '티어표',
    Icon: List,
    isActive: (p: string) => p.startsWith('/tier/feed'),
  },
  {
    href: '/community',
    label: '커뮤니티',
    Icon: MessagesSquare,
    isActive: (p: string) => p.startsWith('/community'),
  },
  // 후순위 미구현: 이상형 월드컵
  // { href: '/worldcup', label: '이상형 월드컵' },
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

  // 햄버거 메뉴 외부 클릭
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

  // 내 정보 드롭다운 외부 클릭
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
    <nav className="shrink-0 w-full border-b border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm transition-colors duration-200 relative z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        <Link
          href="/"
          className="text-lg font-black bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent shrink-0 select-none"
        >
          Pickty
        </Link>

        <div className="hidden md:flex items-center">
          <div
            className="flex items-center gap-0.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/90 dark:bg-zinc-900/70 p-1 shadow-sm shadow-slate-200/40 dark:shadow-black/20"
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
                    'inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-white dark:bg-zinc-800 text-violet-700 dark:text-violet-300 shadow-sm ring-1 ring-slate-200/80 dark:ring-zinc-600'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-zinc-800/80',
                  ].join(' ')}
                >
                  <Icon className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 shrink-0">
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
                  'h-9 text-sm px-3 rounded-xl border transition-colors inline-flex items-center gap-1.5',
                  accountOpen
                    ? 'border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/40 text-slate-900 dark:text-zinc-100'
                    : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-900',
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
                  className="absolute right-0 mt-1 min-w-[11rem] rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 shadow-lg shadow-black/10 dark:shadow-black/40 z-50"
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
                    className={`${accountLinkClass} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30`}
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="h-9 inline-flex items-center justify-center rounded-xl px-4 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors shadow-sm shadow-violet-600/25 hover:shadow-violet-500/30"
            >
              로그인
            </Link>
          )}
        </div>

        <div className="flex md:hidden items-center gap-1 shrink-0" ref={menuRef}>
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
              'w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg transition-colors',
              menuOpen
                ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100'
                : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60',
            ].join(' ')}
          >
            <span className={`block w-4 h-0.5 bg-current rounded-full transition-all duration-200 ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block w-4 h-0.5 bg-current rounded-full transition-all duration-200 ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
            <span className={`block w-4 h-0.5 bg-current rounded-full transition-all duration-200 ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute top-14 right-0 left-0 border-b border-slate-200 dark:border-zinc-800 bg-white/98 dark:bg-zinc-950/98 backdrop-blur-sm shadow-lg">
              <div className="max-w-6xl mx-auto px-4 py-2 flex flex-col gap-1">
                {NAV_LINKS.map(({ href, label, Icon, isActive }) => {
                  const active = isActive(pathname);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={[
                        'flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-xl border transition-colors',
                        active
                          ? 'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 font-medium'
                          : 'text-slate-600 dark:text-zinc-300 border-transparent hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:border-slate-200 dark:hover:border-zinc-700',
                      ].join(' ')}
                    >
                      <Icon className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
                      {label}
                    </Link>
                  );
                })}

                <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />

                {accessToken ? (
                  <>
                    <Link
                      href="/account"
                      className="text-sm px-3 py-2.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors"
                    >
                      내 계정
                    </Link>
                    <Link
                      href="/tier/my"
                      className="text-sm px-3 py-2.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors"
                    >
                      내 티어표
                    </Link>
                    <Link
                      href="/templates/mine"
                      className="text-sm px-3 py-2.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors"
                    >
                      내 템플릿
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="text-sm px-3 py-2.5 rounded-lg text-left text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="h-9 flex items-center justify-center text-sm rounded-xl text-center bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors shadow-sm"
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
