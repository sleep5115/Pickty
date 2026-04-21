import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TierPageClient } from './tier-page-client';
import { fetchTemplateForOpenGraph } from '@/lib/template-opengraph';
import { PUBLIC_SITE_URL } from '@/lib/public-site-config';

const FALLBACK_TITLE = 'Pickty';

function siteOrigin(): string {
  return PUBLIC_SITE_URL.replace(/\/$/, '');
}

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>;

function pickString(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = sp[key];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return undefined;
}

function pickTemplateId(sp: Record<string, string | string[] | undefined>): string | undefined {
  return pickString(sp, 'templateId');
}

function pickSourceResultId(sp: Record<string, string | string[] | undefined>): string | undefined {
  return pickString(sp, 'sourceResultId');
}

export async function generateMetadata(props: { searchParams: SearchParamsInput }): Promise<Metadata> {
  const sp = await props.searchParams;
  const templateId = pickTemplateId(sp);
  const canonicalBase = siteOrigin();

  if (!templateId) {
    return {
      metadataBase: new URL(canonicalBase),
      title: FALLBACK_TITLE,
      openGraph: {
        title: FALLBACK_TITLE,
        siteName: 'Pickty',
        type: 'website',
        url: `${canonicalBase}/tier`,
      },
    };
  }

  const pageUrl = `${canonicalBase}/tier/templates/${encodeURIComponent(templateId)}`;
  const og = await fetchTemplateForOpenGraph(templateId);

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

export default async function TierPage(props: { searchParams: SearchParamsInput }) {
  const sp = await props.searchParams;
  const tid = pickTemplateId(sp);
  if (tid) {
    const src = pickSourceResultId(sp);
    const q =
      src && src.length > 0
        ? `?${new URLSearchParams({ sourceResultId: src }).toString()}`
        : '';
    redirect(`/tier/templates/${encodeURIComponent(tid)}${q}`);
  }
  return <TierPageClient />;
}
