import { PICKTY_STORED_IMAGE_KEY_RE } from '@/lib/pickty-image-url';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * 브라우저 → img.pickty.app 직접 요청은 Referer(로컬 dev)·ORB·CF 규칙으로 403일 수 있음.
 * 순서: 커스텀 공개 도메인 → PICKTY_IMAGE_PUBLIC_FALLBACK_BASE(pub-*.r2.dev) → API file → FILE_FALLBACK API.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('key')?.trim();
  if (!raw || raw.includes('..')) {
    return new NextResponse('Not Found', { status: 404 });
  }
  const normalized = raw.toLowerCase();
  if (!PICKTY_STORED_IMAGE_KEY_RE.test(normalized)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const imgBase =
    process.env.PICKTY_IMAGE_PUBLIC_BASE?.trim().replace(/\/$/, '') ?? 'https://img.pickty.app';

  const tryFetchImg = (url: string) =>
    fetch(url, {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        // 일부 Cloudflare 규칙이 기본 fetch UA를 막음 — 브라우저에 가깝게 (효과 없을 수 있음)
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 86_400 },
    });

  const tryFetchApi = (url: string) =>
    fetch(url, {
      headers: { Accept: 'image/*,*/*;q=0.8' },
      next: { revalidate: 86_400 },
    });

  let upstream = await tryFetchImg(`${imgBase}/${normalized}`);
  let lastStatus = upstream.status;
  const tried: string[] = [`img:${upstream.status}`];

  if (!upstream.ok) {
    const publicFallbackBase = process.env.PICKTY_IMAGE_PUBLIC_FALLBACK_BASE?.trim().replace(/\/$/, '');
    if (publicFallbackBase && publicFallbackBase !== imgBase) {
      upstream = await tryFetchImg(`${publicFallbackBase}/${normalized}`);
      lastStatus = upstream.status;
      tried.push(`pub:${upstream.status}`);
    }
  }

  if (!upstream.ok) {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '') || 'https://api.pickty.app';
    const primaryApiUrl = `${apiBase}/api/v1/images/file?key=${encodeURIComponent(normalized)}`;
    upstream = await tryFetchApi(primaryApiUrl);
    lastStatus = upstream.status;
    tried.push(`api:${upstream.status}`);

    if (!upstream.ok) {
      const fallbackBase = process.env.PICKTY_IMAGE_FILE_FALLBACK_BASE?.trim().replace(/\/$/, '');
      if (fallbackBase && fallbackBase !== apiBase) {
        const fallbackUrl = `${fallbackBase}/api/v1/images/file?key=${encodeURIComponent(normalized)}`;
        upstream = await tryFetchApi(fallbackUrl);
        lastStatus = upstream.status;
        tried.push(`api-fallback:${upstream.status}`);
      }
    }
  }

  if (!upstream.ok) {
    if (process.env.NODE_ENV === 'development') {
      const api404 = tried.some((t) => t === 'api:404' || t.startsWith('api-fallback:404'));
      const img403 = tried.some((t) => t === 'img:403');
      const noPubFallback = !process.env.PICKTY_IMAGE_PUBLIC_FALLBACK_BASE?.trim();
      let hint: string;
      if (api404 && img403 && noPubFallback) {
        hint =
          'img 403 + API 404 → Cloudflare R2 대시보드에서 버킷 Public URL(pub-*.r2.dev)를 확인한 뒤 .env.local 에 PICKTY_IMAGE_PUBLIC_FALLBACK_BASE=<그 베이스 URL> (슬래시 없이). 로컬만 localhost API면 PICKTY_IMAGE_FILE_FALLBACK_BASE=https://api.pickty.app 도 검토.';
      } else if (api404) {
        hint =
          'API 404 → S3 API로 붙은 버킷에 객체가 없거나 자격·계정이 r2.dev 공개 경로와 다를 수 있음. 운영 로그 R2 fetch miss·Cloudflare 버킷 설정 확인.';
      } else {
        hint =
          '로컬 API만 쓰고 운영 file API가 필요하면 PICKTY_IMAGE_FILE_FALLBACK_BASE=https://api.pickty.app';
      }
      console.warn(`[pickty-image] key=${normalized} — ${tried.join(', ')}. ${hint}`);
    }
    const out =
      lastStatus >= 400 && lastStatus < 500 ? lastStatus : 502;
    return new NextResponse(null, { status: out });
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const contentLength = upstream.headers.get('content-length');

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  headers.set('Access-Control-Allow-Origin', '*');
  if (contentLength) {
    headers.set('Content-Length', contentLength);
  }

  return new NextResponse(upstream.body, { status: 200, headers });
}
