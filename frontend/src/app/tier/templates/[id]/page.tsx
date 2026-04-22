import type { Metadata } from 'next';
import { TierPageClient } from '../../tier-page-client';
import { fetchTemplateForOpenGraph } from '@/lib/template-opengraph';
import { PUBLIC_SITE_URL } from '@/lib/public-site-config';

const FALLBACK_TITLE = 'Pickty';

function siteOrigin(): string {
  return PUBLIC_SITE_URL.replace(/\/$/, '');
}

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const canonicalBase = siteOrigin();
  const pageUrl = `${canonicalBase}/tier/templates/${encodeURIComponent(id)}`;

  const og = await fetchTemplateForOpenGraph(id);

  if (!og) {
    return {
      metadataBase: new URL(canonicalBase),
      title: FALLBACK_TITLE,
      openGraph: {
        title: FALLBACK_TITLE,
        siteName: 'Pickty',
        type: 'website',
        url: pageUrl,
      },
    };
  }

  const title = `${og.title} - Pickty`;
  const hasImage = Boolean(og.imageUrl);

  return {
    metadataBase: new URL(canonicalBase),
    title,
    openGraph: {
      title,
      siteName: 'Pickty',
      type: 'website',
      url: pageUrl,
      images: hasImage ? [{ url: og.imageUrl!, alt: og.title }] : undefined,
    },
    twitter: {
      card: hasImage ? 'summary_large_image' : 'summary',
      title,
      images: hasImage ? [og.imageUrl!] : undefined,
    },
  };
}

export default async function TierTemplatePlayPage({ params }: PageProps) {
  const { id } = await params;
  return <TierPageClient routeTemplateId={id} />;
}
