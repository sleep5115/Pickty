import { parseTemplateThumbnailUrl } from '@/lib/tier-api';
import { resolvePicktyImageUrlForOpenGraph } from '@/lib/pickty-image-url';
import { PUBLIC_API_BASE_URL } from '@/lib/public-site-config';

export type TemplateOgPayload = {
  title: string;
  imageUrl: string | null;
};

/**
 * `generateMetadata` 전용 — 공개 GET 템플릿 상세.
 */
export async function fetchTemplateForOpenGraph(templateId: string): Promise<TemplateOgPayload | null> {
  const base = PUBLIC_API_BASE_URL.replace(/\/$/, '');
  const url = `${base}/api/v1/templates/${encodeURIComponent(templateId)}?countView=false`;
  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) return null;
    const row = (await res.json()) as Record<string, unknown>;
    const title =
      typeof row.title === 'string' && row.title.trim() ? row.title.trim() : '티어 템플릿';
    const rawThumb = parseTemplateThumbnailUrl(row);
    return {
      title,
      imageUrl: resolvePicktyImageUrlForOpenGraph(rawThumb),
    };
  } catch {
    return null;
  }
}
