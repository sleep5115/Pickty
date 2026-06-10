'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, LogIn } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 비회원 프로필 생성 성공 모달.
 * 완성된 주소 + 복사 버튼, 임시 프로필 경고, 소셜 로그인 영구저장 유도(전환 장치)를 노출한다.
 */
export function GuestCreateSuccessModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const profileUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/profile/${slug}`
      : `https://pickty.app/profile/${slug}`;
  const displayUrl = profileUrl.replace(/^https?:\/\//, '');

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success('프로필 주소를 복사했습니다.');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 text-[var(--text-primary)]"
      >
        <h2 className="text-center text-lg font-black">🎉 겜생프로필이 성공적으로 생성되었습니다!</h2>

        {/* 주소 + 복사 */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayUrl}</span>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '복사됨' : '주소 복사'}
          </button>
        </div>

        {/* 경고 + 로그인 권장 */}
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          ※ 본 프로필 카드는 로그인하지 않고 생성한 임시 프로필입니다. 브라우저 캐시를 지우면 주소를 잃어버릴 수 있으니
          주소를 복사해 안전하게 보관해 두세요. 매번 복사하고 주소를 찾아오기 번거로우시다면, 아래{' '}
          <strong>[소셜 로그인 연동]</strong>을 통해 내 계정에 영구 저장해 두세요!
        </p>

        {/* 액션 */}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white transition hover:bg-violet-500"
          >
            <LogIn className="h-4 w-4" />
            소셜 로그인 연동
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border-subtle)] py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-base)]"
          >
            내 프로필 보러가기
          </button>
        </div>
      </div>
    </div>
  );
}
