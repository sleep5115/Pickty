'use client';

import { useMemo, useState } from 'react';
import { ImageIcon, Film, Link2 } from 'lucide-react';
import {
  classifyWorldCupMediaUrl,
  getYoutubeThumbnailUrl,
  parseYoutubeVideoId,
} from '@/lib/worldcup/worldcup-media-url';

function TryLoadImage({ url }: { url: string }) {
  const [bad, setBad] = useState(false);
  if (bad) {
    return (
      <div
        className="flex size-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-violet-50 text-violet-700 dark:border-zinc-600 dark:bg-violet-950/40 dark:text-violet-300"
        title={url}
      >
        <Link2 className="size-5 opacity-90" aria-hidden />
        <span className="max-w-[3.5rem] truncate px-0.5 text-[9px] font-medium leading-none">URL</span>
      </div>
    );
  }
  return (
    <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-zinc-600 dark:bg-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="size-full object-cover" onError={() => setBad(true)} />
    </div>
  );
}

export function WorldCupEditorMediaPreview({ url }: { url: string }) {
  const trimmed = url.trim();
  const kind = useMemo(() => classifyWorldCupMediaUrl(trimmed), [trimmed]);
  const videoId = useMemo(() => parseYoutubeVideoId(trimmed), [trimmed]);

  if (!trimmed) {
    return (
      <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-600">
        <ImageIcon className="size-6 opacity-50" aria-hidden />
      </div>
    );
  }

  if (kind === 'youtube' && videoId) {
    const thumb = getYoutubeThumbnailUrl(videoId, 'mq');
    return (
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-black/5 dark:border-zinc-600">
        {/* eslint-disable-next-line @next/next/no-img-element -- 유튜브 정적 썸네일 */}
        <img src={thumb} alt="" className="size-full object-cover" />
        <span className="absolute bottom-0.5 right-0.5 flex size-5 items-center justify-center rounded bg-red-600 text-white shadow">
          <Film className="size-3" aria-hidden />
        </span>
      </div>
    );
  }

  return <TryLoadImage key={trimmed} url={trimmed} />;
}
