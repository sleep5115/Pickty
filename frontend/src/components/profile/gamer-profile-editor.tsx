'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { useAuthStore } from '@/lib/store/auth-store';
import {
  checkSlug,
  fetchGameStats,
  uploadProfileImages,
  type EditableCard,
  type GamerProfileCard,
} from '@/lib/api/gamer-profile-api';
import { AiGamerCardGenerator } from './ai-gamer-card-generator';

type FeedType = 'REALITY' | 'PROOF';
type FeedDraft = { imageUrl: string; description: string | null; feedType: FeedType };

export type EditorSubmitData = {
  customSlug?: string;
  guestPassword?: string;
  cards: EditableCard[];
  feeds: FeedDraft[];
};

function slugify(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return s.replace(/^-|-$/g, '') || 'custom-game';
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{2,49}$/;

export function GamerProfileEditor({
  mode,
  initial,
  onSubmit,
  submitLabel,
}: {
  mode: 'create' | 'edit';
  initial: { cards: EditableCard[]; feeds: FeedDraft[] };
  onSubmit: (data: EditorSubmitData) => Promise<void>;
  submitLabel: string;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  // SSR/CSR Hydration 불일치 방지: 마운트 완료 후에만 로그인 여부를 판정한다.
  // (persist 스토어가 클라이언트에서 토큰을 복원하기 전엔 비회원으로 간주 → 암구호 칸이 안전하게 노출됨)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isLoggedIn = mounted && Boolean(accessToken);

  // 생성 전용: 주소 ID + 암구호
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  const [password, setPassword] = useState('');

  // 카드 / 피드 (피드는 feedType 으로 현실/인증을 한 배열에 누적)
  const [cards, setCards] = useState<EditableCard[]>(initial.cards);
  const [feeds, setFeeds] = useState<FeedDraft[]>(initial.feeds);
  const [realityBusy, setRealityBusy] = useState(false);
  const [proofBusy, setProofBusy] = useState(false);

  // 전적 연동 미니폼
  const [apiGameSlug, setApiGameSlug] = useState('league-of-legends');
  const [apiIdentifier, setApiIdentifier] = useState('');
  const [apiBusy, setApiBusy] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // 슬러그 중복 체크(디바운스)
  useEffect(() => {
    if (mode !== 'create') return;
    const s = slug.trim().toLowerCase();
    if (s.length === 0) {
      setSlugStatus('idle');
      return;
    }
    if (!SLUG_RE.test(s)) {
      setSlugStatus('invalid');
      return;
    }
    setSlugStatus('checking');
    const t = setTimeout(() => {
      void (async () => {
        try {
          const available = await checkSlug(s);
          setSlugStatus(available ? 'ok' : 'taken');
        } catch {
          setSlugStatus('idle');
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [slug, mode]);

  const uploadFeed = useCallback(
    async (files: FileList | null, feedType: FeedType, setBusy: (v: boolean) => void) => {
      if (!files || files.length === 0) return;
      setBusy(true);
      try {
        const urls = await uploadProfileImages(Array.from(files), accessToken);
        setFeeds((prev) => [...prev, ...urls.map((u) => ({ imageUrl: u, description: null, feedType }))]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '사진 업로드 실패');
      } finally {
        setBusy(false);
      }
    },
    [accessToken],
  );

  const removeFeed = useCallback((target: FeedDraft) => {
    setFeeds((prev) => prev.filter((f) => f !== target));
  }, []);

  const appendAiCards = useCallback((parsed: GamerProfileCard[]) => {
    setCards((prev) => [
      ...prev,
      ...parsed.map((c) => ({
        gameSlug: c.gameSlug,
        gameSource: c.gameSource,
        gameTitle: c.gameTitle,
        gameIconUrl: c.gameIconUrl,
        externalApiIdentifier: c.externalApiIdentifier,
        isMain: false,
        stats: c.stats,
      })),
    ]);
  }, []);

  const addManualCard = useCallback(() => {
    setCards((prev) => [
      ...prev,
      {
        gameSlug: '',
        gameSource: 'DIRECT',
        gameTitle: '',
        gameIconUrl: null,
        externalApiIdentifier: null,
        isMain: false,
        stats: [],
      },
    ]);
  }, []);

  const onFetchStats = useCallback(async () => {
    const id = apiIdentifier.trim();
    if (id.length === 0) {
      toast.error('소환사명·배틀태그 등 식별값을 입력해 주세요.');
      return;
    }
    setApiBusy(true);
    try {
      const r = await fetchGameStats(apiGameSlug, id);
      setCards((prev) => [
        ...prev,
        {
          gameSlug: r.gameSlug,
          gameSource: 'API',
          gameTitle: r.gameTitle,
          gameIconUrl: r.gameIconUrl,
          externalApiIdentifier: id,
          isMain: false,
          stats: r.stats,
        },
      ]);
      setApiIdentifier('');
      toast.success('전적을 카드로 불러왔어요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '전적 조회 실패');
    } finally {
      setApiBusy(false);
    }
  }, [apiGameSlug, apiIdentifier]);

  const patchCard = useCallback((idx: number, patch: Partial<EditableCard>) => {
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }, []);

  // 대표 게임은 1개만 — 토글 시 나머지는 해제.
  const toggleMain = useCallback((idx: number) => {
    setCards((prev) => prev.map((c, i) => ({ ...c, isMain: i === idx ? !c.isMain : false })));
  }, []);

  const onSubmitClick = useCallback(async () => {
    const validCards = cards.filter((c) => c.gameTitle.trim() !== '');
    const data: EditorSubmitData = {
      cards: validCards.map((c) => ({ ...c, gameSlug: c.gameSlug.trim() || slugify(c.gameTitle) })),
      feeds,
    };
    if (mode === 'create') {
      const s = slug.trim().toLowerCase();
      if (!SLUG_RE.test(s) || slugStatus === 'taken') {
        toast.error('사용 가능한 주소 ID를 입력해 주세요.');
        return;
      }
      data.customSlug = s;
      if (!isLoggedIn) {
        if (password.trim().length < 4) {
          toast.error('암구호는 4자 이상이어야 합니다.');
          return;
        }
        data.guestPassword = password.trim();
      }
    }
    setSubmitting(true);
    try {
      await onSubmit(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setSubmitting(false);
    }
  }, [cards, feeds, mode, slug, slugStatus, isLoggedIn, password, onSubmit]);

  const realityFeeds = feeds.filter((f) => f.feedType === 'REALITY');
  const proofFeeds = feeds.filter((f) => f.feedType === 'PROOF');

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 text-[var(--text-primary)]">
      <h1 className="mb-6 text-2xl font-black">
        {mode === 'create' ? '게임인생프로필 만들기' : '프로필 편집'}
      </h1>

      {/* 생성: 주소 ID / 암구호 (이 2가지만 입력) */}
      {mode === 'create' ? (
        <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <label className="text-sm font-bold">주소 ID (내 프로필 주소)</label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-secondary)]">pickty.app/profile/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-nickname"
              className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 outline-none focus:border-violet-400"
            />
          </div>
          <p className="text-xs">
            {slugStatus === 'checking' && <span className="text-[var(--text-secondary)]">확인 중…</span>}
            {slugStatus === 'ok' && <span className="text-emerald-600">사용 가능한 주소예요.</span>}
            {slugStatus === 'taken' && <span className="text-rose-600">이미 사용 중인 주소예요.</span>}
            {slugStatus === 'invalid' && (
              <span className="text-rose-600">영문 소문자·숫자·-·_ 3~50자만 가능해요.</span>
            )}
          </p>

          {!isLoggedIn ? (
            <>
              <label className="mt-2 text-sm font-bold">암구호 (수정용 비밀번호)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="4자 이상"
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm outline-none focus:border-violet-400"
              />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ※ 암구호를 분실하면 프로필을 수정하거나 인증샷을 추가할 수 없으니 꼭 기억해 주세요!
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      {/* AI 생성 */}
      <section className="mb-4">
        <AiGamerCardGenerator onCardsParsed={appendAiCards} />
      </section>

      {/* 전적 연동 미니폼 */}
      <section className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-sm">
        <span className="font-bold">전적 연동</span>
        <select
          value={apiGameSlug}
          onChange={(e) => setApiGameSlug(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5"
        >
          <option value="league-of-legends">리그 오브 레전드</option>
          <option value="overwatch-2">오버워치 2</option>
        </select>
        <input
          value={apiIdentifier}
          onChange={(e) => setApiIdentifier(e.target.value)}
          placeholder="소환사명#KR1"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5"
        />
        <button
          type="button"
          onClick={() => void onFetchStats()}
          disabled={apiBusy}
          className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 font-medium text-violet-700 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
        >
          {apiBusy ? '조회 중…' : '불러오기'}
        </button>
      </section>

      {/* 카드 목록 편집 */}
      <section className="mb-6 flex flex-col gap-3">
        {cards.map((card, idx) => (
          <CardEditorRow
            key={idx}
            card={card}
            onPatch={(patch) => patchCard(idx, patch)}
            onToggleMain={() => toggleMain(idx)}
            onRemove={() => setCards((prev) => prev.filter((_, i) => i !== idx))}
          />
        ))}
        <button
          type="button"
          onClick={addManualCard}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:border-violet-400 hover:text-violet-600"
        >
          <Plus className="h-4 w-4" /> 게임 카드 직접 추가
        </button>
      </section>

      {/* 하단 이미지 — 현실 피드 / 자율 인증 갤러리 이원화 (명함 바깥) */}
      <FeedUploadSection
        title="현실 피드 (데스크셋업·장비·굿즈)"
        feeds={realityFeeds}
        busy={realityBusy}
        onPick={(files) => void uploadFeed(files, 'REALITY', setRealityBusy)}
        onRemove={removeFeed}
      />
      <FeedUploadSection
        title="자율 인증 갤러리 (자율 인증샷)"
        hint="인증샷을 1장 이상 올리면 명함 꼬리말에 공유 주소가 노출됩니다."
        feeds={proofFeeds}
        busy={proofBusy}
        onPick={(files) => void uploadFeed(files, 'PROOF', setProofBusy)}
        onRemove={removeFeed}
      />

      <button
        type="button"
        onClick={() => void onSubmitClick()}
        disabled={submitting}
        className="mt-8 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
      >
        {submitting ? '저장 중…' : submitLabel}
      </button>
    </div>
  );
}

/** 하단 이미지 업로드 섹션 — 현실 피드/인증 갤러리 공용. */
function FeedUploadSection({
  title,
  hint,
  feeds,
  busy,
  onPick,
  onRemove,
}: {
  title: string;
  hint?: string;
  feeds: FeedDraft[];
  busy: boolean;
  onPick: (files: FileList | null) => void;
  onRemove: (feed: FeedDraft) => void;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-1 text-sm font-bold">{title}</h2>
      {hint ? <p className="mb-2 text-xs text-[var(--text-secondary)]">{hint}</p> : null}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
        {feeds.map((f, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border-subtle)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={picktyImageDisplaySrc(f.imageUrl)} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(f)}
              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label="삭제"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] transition hover:border-violet-400 hover:text-violet-600">
          {busy ? '업로드 중…' : '+ 사진 추가'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
        </label>
      </div>
    </section>
  );
}

/** 카드 1개 편집 행 — 타이틀·대표지정·스탯. (개별 인증샷 첨부는 하단 인증 갤러리로 통합 이전) */
function CardEditorRow({
  card,
  onPatch,
  onToggleMain,
  onRemove,
}: {
  card: EditableCard;
  onPatch: (patch: Partial<EditableCard>) => void;
  onToggleMain: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border bg-[var(--bg-elevated)] p-4 ${
        card.isMain ? 'border-violet-400 ring-1 ring-violet-300/50' : 'border-[var(--border-subtle)]'
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          value={card.gameTitle}
          onChange={(e) => onPatch({ gameTitle: e.target.value })}
          placeholder="게임명 (예: 할로우 나이트)"
          maxLength={100}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
        />
        <button
          type="button"
          onClick={onToggleMain}
          title="대표 게임으로 지정 (신문 격자에서 크게 표시)"
          className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2 text-xs font-medium transition ${
            card.isMain
              ? 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200'
              : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-violet-400'
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${card.isMain ? 'fill-violet-500 text-violet-500' : ''}`} />
          대표
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 text-rose-500 transition hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30"
          aria-label="카드 삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* 스탯 행 */}
      <div className="mt-3 flex flex-col gap-2">
        {card.stats.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={s.statKey}
              onChange={(e) =>
                onPatch({ stats: card.stats.map((x, idx) => (idx === i ? { ...x, statKey: e.target.value } : x)) })
              }
              placeholder="스탯명 (최고티어)"
              maxLength={100}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            />
            <input
              value={s.statValue}
              onChange={(e) =>
                onPatch({ stats: card.stats.map((x, idx) => (idx === i ? { ...x, statValue: e.target.value } : x)) })
              }
              placeholder="값 (다이아2)"
              maxLength={100}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            />
            <button
              type="button"
              onClick={() => onPatch({ stats: card.stats.filter((_, idx) => idx !== i) })}
              className="shrink-0 text-[var(--text-secondary)] hover:text-rose-500"
              aria-label="스탯 삭제"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onPatch({ stats: [...card.stats, { statKey: '', statValue: '' }] })}
          className="self-start text-xs font-medium text-violet-600 dark:text-violet-300"
        >
          + 스탯 추가
        </button>
      </div>
    </div>
  );
}
