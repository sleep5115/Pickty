import type { Metadata } from 'next';
import { TierResultClientPage } from './tier-result-client-page';
import {
  fetchTierResultForOpenGraph,
  TIER_RESULT_OG_DEFAULT_DESCRIPTION,
} from '@/lib/tier-result-opengraph';
import { PUBLIC_SITE_URL } from '@/lib/public-site-config';

const FALLBACK_METADATA_TITLE = 'Pickty — 티어표 만들기';

function siteOrigin(): string {
  return PUBLIC_SITE_URL.replace(/\/$/, '');
}

async function resolveParams(
  params: { id: string } | Promise<{ id: string }>,
): Promise<{ id: string }> {
  return await Promise.resolve(params);
}

export async function generateMetadata({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await resolveParams(params);
  const canonicalBase = siteOrigin();
  const pagePath = `/tier/results/${encodeURIComponent(id)}`;
  const canonicalUrl = `${canonicalBase}${pagePath}`;

  const og = await fetchTierResultForOpenGraph(id);

  if (!og) {
    return {
      metadataBase: new URL(canonicalBase),
      title: FALLBACK_METADATA_TITLE,
      description: TIER_RESULT_OG_DEFAULT_DESCRIPTION,
      openGraph: {
        title: FALLBACK_METADATA_TITLE,
        description: TIER_RESULT_OG_DEFAULT_DESCRIPTION,
        type: 'website',
        siteName: 'Pickty',
        url: canonicalUrl,
      },
      twitter: {
        card: 'summary',
        title: FALLBACK_METADATA_TITLE,
        description: TIER_RESULT_OG_DEFAULT_DESCRIPTION,
      },
    };
  }

  const title = `${og.headline} - Pickty`;
  const hasImage = Boolean(og.imageUrl);

  return {
    metadataBase: new URL(canonicalBase),
    title,
    description: og.description,
    openGraph: {
      title,
      description: og.description,
      type: 'website',
      siteName: 'Pickty',
      url: canonicalUrl,
      images: hasImage
        ? [
            {
              url: og.imageUrl!,
              alt: og.headline,
            },
          ]
        : undefined,
    },
    twitter: {
      card: hasImage ? 'summary_large_image' : 'summary',
      title,
      description: og.description,
      images: hasImage ? [og.imageUrl!] : undefined,
    },
  };
}

export default function TierResultPage() {
  return <TierResultClientPage />;
}
