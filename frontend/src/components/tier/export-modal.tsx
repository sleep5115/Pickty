'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { captureTierElementToPng, formatImageCaptureError } from '@/lib/tier-capture-png';
import { uploadPicktyImages } from '@/lib/image-upload-api';
import { useTierStore } from '@/lib/store/tier-store';
import { createTemplate, createTierResult } from '@/lib/tier-api';
import { buildTierSnapshot, collectDistinctItems } from '@/lib/tier-snapshot';

interface ExportModalProps {
  captureRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

const BENEFITS = [
  '티어표를 계정에 저장',
  '어느 기기에서나 저장한 티어표 수정',
  '커뮤니티 랭킹에 참여',
  '나만의 템플릿 제작',
];

export function ExportModal({ captureRef, onClose }: ExportModalProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isLoggedIn = !!accessToken;

  const tiers = useTierStore((s) => s.tiers);
  const pool = useTierStore((s) => s.pool);
  const templateId = useTierStore((s) => s.templateId);
  const setTemplateId = useTierStore((s) => s.setTemplateId);

  const [listTitle, setListTitle] = useState('');
  const [listDescription, setListDescription] = useState('');

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const generate = useCallback(async () => {
    const el = captureRef.current;
    if (!el) return;

    setIsGenerating(true);
    setPreviewUrl(null);

    const CAPTURE_WIDTH = 800;

    try {
      const url = await captureTierElementToPng(el, CAPTURE_WIDTH);
      setPreviewUrl(url);
    } catch (err) {
      console.error('캡처 실패:', formatImageCaptureError(err), err);
    } finally {
      setIsGenerating(false);
    }
  }, [captureRef]);

  useEffect(() => {
    generate();
  }, [generate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDownloaded(false);
        setSavedPath(null);
        setSaveError(null);
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleClose = () => {
    setIsDownloaded(false);
    setSavedPath(null);
    setSaveError(null);
    onClose();
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    const base = isLoggedIn ? listTitle.trim().replace(/[/\\?%*:|"<>]/g, '') || 'tier-list' : 'tier-list';
    a.download = `${base}-${Date.now()}.png`;
    a.click();
    // 로그인 상태에서는 다운로드만 하고, 비로그인용 완료·로그인 유도 화면으로 넘기지 않음
    if (!isLoggedIn) setIsDownloaded(true);
  };

  const handleSave = async () => {
    if (!accessToken) return;
    const title = listTitle.trim();
    if (!title) {
      setSaveError('티어표 제목을 입력해 주세요.');
      return;
    }
    if (!previewUrl) {
      setSaveError('미리보기를 생성한 뒤 저장해 주세요.');
      return;
    }
    setSaveError(null);
    setSaveBusy(true);
    try {
      let tid = templateId;
      if (!tid) {
        const items = collectDistinctItems(tiers, pool);
        const created = await createTemplate({ title, items: { items } }, accessToken);
        tid = created.id;
        setTemplateId(tid);
      }

      const blob = await fetch(previewUrl).then((r) => r.blob());
      const file = new File([blob], 'tier-result.png', { type: 'image/png' });
      const uploaded = await uploadPicktyImages([file], accessToken);
      const thumbnailUrl = uploaded[0] ?? null;

      const snapshot = buildTierSnapshot(tiers, pool);
      const result = await createTierResult(
        {
          templateId: tid,
          snapshotData: snapshot,
          listTitle: title,
          listDescription: listDescription.trim() || null,
          isPublic: false,
          thumbnailUrl,
        },
        accessToken,
      );
      setSavedPath(`/tier/result/${result.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaveBusy(false);
    }
  };

  const copySavedLink = () => {
    if (!savedPath || typeof window === 'undefined') return;
    void navigator.clipboard.writeText(`${window.location.origin}${savedPath}`);
  };

  const modalWidthClass = isLoggedIn
    ? 'w-[min(560px,calc(100vw-2rem))]'
    : 'w-[520px] max-w-[calc(100vw-2rem)]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`${modalWidthClass} max-h-[85vh] rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-2xl shadow-black/60 flex flex-col overflow-hidden touch-manipulation`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {savedPath ? (
          <ServerSavedView savedPath={savedPath} onCopyLink={copySavedLink} onClose={handleClose} />
        ) : isDownloaded ? (
          <DownloadedView onClose={handleClose} />
        ) : isLoggedIn ? (
          <LoggedInSaveDownloadPanel
            listTitle={listTitle}
            setListTitle={setListTitle}
            listDescription={listDescription}
            setListDescription={setListDescription}
            previewUrl={previewUrl}
            isGenerating={isGenerating}
            saveBusy={saveBusy}
            saveError={saveError}
            onDownload={handleDownload}
            onSave={handleSave}
            onRegenerate={generate}
            onClose={handleClose}
          />
        ) : (
          <GuestDownloadOnlyPanel
            previewUrl={previewUrl}
            isGenerating={isGenerating}
            onDownload={handleDownload}
            onRegenerate={generate}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}

/** 비로그인: 예전 모달과 동일 — 로그인 안내 + 이미지 다운로드만 */
function GuestDownloadOnlyPanel({
  previewUrl,
  isGenerating,
  onDownload,
  onRegenerate,
  onClose,
}: {
  previewUrl: string | null;
  isGenerating: boolean;
  onDownload: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
        <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
          티어표를 프로필에 저장하려면{' '}
          <Link
            href="/login?returnTo=%2Ftier"
            className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            로그인
          </Link>
          하세요.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="ml-4 shrink-0 text-slate-400 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors text-xl leading-none"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      <div className="px-5 pt-4 pb-2 shrink-0">
        <button
          type="button"
          onClick={onDownload}
          disabled={!previewUrl}
          className={[
            'w-full py-3 rounded-lg font-semibold text-sm transition-all',
            previewUrl
              ? 'bg-violet-600 hover:bg-violet-500 text-white active:scale-[0.98] shadow-lg shadow-violet-900/30'
              : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed',
          ].join(' ')}
        >
          이미지 다운로드
        </button>
      </div>

      <div className="px-5 pb-3 flex justify-end shrink-0">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isGenerating}
          className="text-xs text-slate-500 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-400 disabled:opacity-40 transition-colors"
        >
          미리보기가 없나요? 다시 생성하기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-[100px]">
        {isGenerating ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-6 h-6 border-2 border-slate-300 dark:border-zinc-700 border-t-violet-400 rounded-full animate-spin" />
            <p className="text-sm text-slate-500 dark:text-zinc-500">미리보기 생성 중...</p>
          </div>
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="티어표 미리보기"
            className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 shadow-lg"
          />
        ) : (
          <p className="text-sm text-slate-500 dark:text-zinc-600 text-center py-10">
            미리보기를 불러올 수 없습니다.
          </p>
        )}
      </div>
    </>
  );
}

/** 로그인: 제목·설명 + 이미지 다운로드 | 서버 저장 */
function LoggedInSaveDownloadPanel({
  listTitle,
  setListTitle,
  listDescription,
  setListDescription,
  previewUrl,
  isGenerating,
  saveBusy,
  saveError,
  onDownload,
  onSave,
  onRegenerate,
  onClose,
}: {
  listTitle: string;
  setListTitle: (v: string) => void;
  listDescription: string;
  setListDescription: (v: string) => void;
  previewUrl: string | null;
  isGenerating: boolean;
  saveBusy: boolean;
  saveError: string | null;
  onDownload: () => void;
  onSave: () => void | Promise<void>;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
        <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
          <strong>저장</strong>은 서버에 두고 링크로 공유 · <strong>다운로드</strong>는 PNG로 저장합니다.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-slate-400 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-200 text-xl leading-none"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      <div className="px-5 pt-4 space-y-3 shrink-0">
        <div>
          <label htmlFor="tier-list-title" className="sr-only">
            티어표 제목
          </label>
          <input
            id="tier-list-title"
            value={listTitle}
            onChange={(e) => setListTitle(e.target.value)}
            placeholder="티어표 제목"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>
        <div>
          <label htmlFor="tier-list-desc" className="sr-only">
            설명
          </label>
          <textarea
            id="tier-list-desc"
            value={listDescription}
            onChange={(e) => setListDescription(e.target.value)}
            placeholder="설명을 추가하세요…"
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>

        {saveError && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {saveError}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onDownload}
            disabled={!previewUrl}
            className={[
              'flex-1 py-3 rounded-lg font-semibold text-sm transition-all border-2',
              previewUrl
                ? 'border-slate-300 dark:border-zinc-600 text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 active:scale-[0.99]'
                : 'border-slate-200 dark:border-zinc-800 text-slate-400 cursor-not-allowed',
            ].join(' ')}
          >
            이미지 다운로드
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saveBusy}
            className="flex-1 py-3 rounded-lg font-semibold text-sm bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-all active:scale-[0.99] shadow-lg shadow-violet-900/25"
          >
            {saveBusy ? '저장 중…' : '저장'}
          </button>
        </div>

        <div className="flex justify-end pb-1">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isGenerating}
            className="text-xs text-slate-500 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-400 disabled:opacity-40"
          >
            미리보기가 없나요? 다시 생성하기
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-[120px]">
        {isGenerating ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="w-6 h-6 border-2 border-slate-300 dark:border-zinc-700 border-t-violet-400 rounded-full animate-spin" />
            <p className="text-sm text-slate-500 dark:text-zinc-500">미리보기 생성 중...</p>
          </div>
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="티어표 미리보기"
            className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 shadow-lg"
          />
        ) : (
          <p className="text-sm text-slate-500 dark:text-zinc-600 text-center py-10">
            미리보기를 불러올 수 없습니다.
          </p>
        )}
      </div>
    </>
  );
}

function ServerSavedView({
  savedPath,
  onCopyLink,
  onClose,
}: {
  savedPath: string;
  onCopyLink: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col px-6 py-8 gap-5">
      <div className="text-center">
        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">저장되었습니다</p>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2">
          아래 링크로 티어표를 다시 열거나 공유할 수 있습니다.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          href={savedPath}
          className="flex-1 text-center py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold"
        >
          결과 페이지 열기
        </Link>
        <button
          type="button"
          onClick={onCopyLink}
          className="flex-1 py-3 rounded-lg border border-slate-300 dark:border-zinc-600 text-sm font-medium text-slate-800 dark:text-zinc-200"
        >
          링크 복사
        </button>
      </div>
      <button type="button" onClick={onClose} className="text-sm text-slate-500 dark:text-zinc-500 hover:underline">
        닫기
      </button>
    </div>
  );
}

function DownloadedView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-10 gap-6">
      <div className="flex flex-col items-center gap-2">
        <p className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">
          🎉 티어표 다운로드 완료!
        </p>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
          로그인하면 이런 것들을 할 수 있어요:
        </p>
      </div>

      <ul className="flex flex-col gap-2.5 text-left w-full max-w-xs">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-zinc-300">
            <span className="shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
              ✓
            </span>
            {benefit}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 w-full max-w-xs pt-1">
        <Link
          href="/login?returnTo=%2Ftier"
          className={[
            'w-full py-3 rounded-lg font-semibold text-sm text-center',
            'bg-violet-600 hover:bg-violet-500 text-white',
            'transition-all active:scale-[0.98] shadow-lg shadow-violet-900/30',
          ].join(' ')}
        >
          로그인
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-slate-500 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-400 transition-colors py-1"
        >
          괜찮아요
        </button>
      </div>
    </div>
  );
}
