'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GamerProfileEditor, type EditorSubmitData } from '@/components/profile/gamer-profile-editor';
import { GuestCreateSuccessModal } from '@/components/profile/guest-create-success-modal';
import { createProfile } from '@/lib/api/gamer-profile-api';
import { saveEditToken } from '@/lib/gamer-profile-edit-token';
import { addProfileHistory } from '@/lib/gamer-profile-history';

export default function GamerProfileCreatePage() {
  const router = useRouter();
  const [successSlug, setSuccessSlug] = useState<string | null>(null);

  const onSubmit = async (data: EditorSubmitData) => {
    const { slug, editToken } = await createProfile({
      customSlug: data.customSlug ?? '',
      guestPassword: data.guestPassword ?? null,
      cards: data.cards,
      feeds: data.feeds,
    });
    addProfileHistory(slug);

    if (editToken) {
      // 비회원: 편집 토큰 보관 후 성공 모달(주소 보관·소셜 로그인 유도)
      saveEditToken(slug, editToken);
      setSuccessSlug(slug);
      return;
    }
    // 회원: 계정에 영구 저장됨 — 바로 프로필로
    toast.success('프로필을 만들었어요!');
    router.push(`/profile/${encodeURIComponent(slug)}`);
  };

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-[var(--bg-base)]">
      <GamerProfileEditor
        mode="create"
        initial={{ cards: [], feeds: [] }}
        onSubmit={onSubmit}
        submitLabel="프로필 만들기"
      />
      {successSlug ? (
        <GuestCreateSuccessModal
          slug={successSlug}
          onClose={() => {
            const slug = successSlug;
            setSuccessSlug(null);
            router.push(`/profile/${encodeURIComponent(slug)}`);
          }}
        />
      ) : null}
    </main>
  );
}
