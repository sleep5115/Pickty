'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  buildWorldCupYoutubePlayEmbedSrc,
  classifyWorldCupMediaUrl,
  getYoutubeThumbnailUrl,
  parseYoutubeVideoId,
} from '@/lib/worldcup/worldcup-media-url';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';

/** 랭킹 행 등 — 유튜브는 정적 썸네일 JPG, 그 외는 표시용 이미지 URL */
export function worldCupMediaListThumbnailSrc(raw: string): string {
  const t = raw.trim();
  const vid = parseYoutubeVideoId(t);
  if (vid) return getYoutubeThumbnailUrl(vid, 'mq');
  return picktyImageDisplaySrc(t);
}

/** 16:9 영역이 부모(패딩 제외) 안에 들어가도록 가로·세로 중 더 촉박한 쪽에 맞춤 */
function WorldCupYoutubeHeroFit({ videoId, title }: { videoId: string; title: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      const cr = el.getBoundingClientRect();
      const rw = Math.max(0, cr.width);
      const rh = Math.max(0, cr.height);
      if (rw < 1 || rh < 1) {
        setBox({ w: 0, h: 0 });
        return;
      }
      const wByHeight = (rh * 16) / 9;
      if (wByHeight <= rw) {
        setBox({ w: Math.floor(wByHeight), h: Math.floor(rh) });
      } else {
        setBox({ w: Math.floor(rw), h: Math.floor((rw * 9) / 16) });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className="absolute inset-0 flex min-h-0 min-w-0 items-center justify-center bg-black px-2 py-3 sm:px-4 sm:py-5"
    >
      <div
        className="overflow-hidden rounded-xl border border-white/10 shadow-lg"
        style={
          box.w > 0 && box.h > 0
            ? { width: box.w, height: box.h }
            : { width: '100%', aspectRatio: '16 / 9', maxHeight: '100%' }
        }
      >
        <iframe
          src={buildWorldCupYoutubePlayEmbedSrc(videoId)}
          title={title}
          className="block h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}

/**
 * 결과 화면 우승자 영역 — 부모가 `relative`·높이 잡힌 컨테이너일 때 꽉 채움.
 */
export function WorldCupUrlHeroMedia({ url, name }: { url: string; name: string }) {
  const t = url.trim();
  if (!t) return null;
  const kind = classifyWorldCupMediaUrl(t);
  const vid = parseYoutubeVideoId(t);

  if (kind === 'youtube' && vid) {
    return <WorldCupYoutubeHeroFit videoId={vid} title={name} />;
  }

  const imgSrc = picktyImageDisplaySrc(t);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- R2·프록시·외부 URL
    <img src={imgSrc} alt={name} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
  );
}

/**
 * 랭킹 아코디언 펼침 영역 — 가로 제한 + 유튜브는 aspect-video iframe.
 */
export function WorldCupUrlAccordionMedia({ url, name }: { url: string; name: string }) {
  const t = url.trim();
  if (!t) return null;
  const kind = classifyWorldCupMediaUrl(t);
  const vid = parseYoutubeVideoId(t);

  if (kind === 'youtube' && vid) {
    return (
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-black shadow-sm dark:border-white/10">
        <div className="aspect-video w-full">
          <iframe
            src={buildWorldCupYoutubePlayEmbedSrc(vid)}
            title={name}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  const imgSrc = picktyImageDisplaySrc(t);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 원본·GIF 포함 동적 URL
    <img
      src={imgSrc}
      alt={name}
      className="mx-auto max-h-[min(70vh,560px)] w-full max-w-2xl rounded-xl border border-zinc-200 object-contain dark:border-white/10"
      draggable={false}
    />
  );
}
