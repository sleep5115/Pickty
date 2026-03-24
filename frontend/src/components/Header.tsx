'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';

export function Header() {
  const router = useRouter();
  const { accessToken, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 px-6 py-3 flex items-center justify-between">
      <Link
        href="/"
        className="text-lg font-black bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent"
      >
        Pickty
      </Link>

      <div className="flex items-center gap-2">
        {accessToken ? (
          <>
            <Link
              href="/account"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-300 hover:text-violet-400 transition-colors"
            >
              내 계정
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-500 border border-zinc-800 hover:border-red-500/50 hover:text-red-400 transition-colors"
            >
              로그아웃
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-zinc-200 border border-zinc-700 hover:border-violet-500 hover:text-violet-400 transition-colors"
          >
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}
