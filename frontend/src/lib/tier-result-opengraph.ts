import { parseResultThumbnailUrl } from '@/lib/tier-api';
import { PUBLIC_API_BASE_URL } from '@/lib/public-site-config';

const DEFAULT_DESCRIPTION = '나만의 티어표를 만들고 공유하세요.';

export type TierResultOgPayload = {
  /** OG title 본문 (`… - Pickty` 앞부분) */
  headline: string;
  description: string;
  imageUrl: string | null;
};

/**
 * `generateMetadata` 전용 — 스냅샷 rewrite 없이 가볍게 조회.
 * 카톡·디스코드 등 크롤러가 이미지 URL을 직접 받을 수 있어야 하므로 절대 URL을 유지합니다.
 */
export async function fetchTierResultForOpenGraph(id: string): Promise<TierResultOgPayload | null> {
  const base = PUBLIC_API_BASE_URL.replace(/\/$/, '');
  const url = `${base}/api/v1/tiers/results/${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) return null;
    const row = (await res.json()) as Record<string, unknown>;
    const templateTitle =
      typeof row.templateTitle === 'string'
        ? row.templateTitle.trim()
        : typeof row.template_title === 'string'
          ? row.template_title.trim()
          : '';
    const listTitle =
      typeof row.listTitle === 'string'
        ? row.listTitle.trim()
        : typeof row.list_title === 'string'
          ? row.list_title.trim()
          : '';
    const listDesc =
      typeof row.listDescription === 'string'
        ? row.listDescription.trim()
        : typeof row.list_description === 'string'
          ? row.list_description.trim()
          : '';
    /** 공유 카드 제목: 지정 시 리스트 제목 우선(유저 표기), 없으면 템플릿 제목 */
    const headline = listTitle || templateTitle || '티어표';
    const description = listDesc || DEFAULT_DESCRIPTION;
    const imageUrl = parseResultThumbnailUrl(row);
    return { headline, description, imageUrl };
  } catch {
    return null;
  }
}

export { DEFAULT_DESCRIPTION as TIER_RESULT_OG_DEFAULT_DESCRIPTION };
