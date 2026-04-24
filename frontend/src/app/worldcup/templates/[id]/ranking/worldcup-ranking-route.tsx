'use client';

import { useRouter } from 'next/navigation';
import { WorldCupRankingClient } from '../worldcup-ranking-client';

export function WorldCupRankingRoute({ templateId }: { templateId: string }) {
  const router = useRouter();
  return (
    <WorldCupRankingClient
      templateId={templateId}
      onBackToResult={() =>
        router.push(`/worldcup/templates/${encodeURIComponent(templateId)}`)
      }
      backNavLabel="월드컵 시작하기"
    />
  );
}
