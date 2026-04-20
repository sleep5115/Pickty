'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useAuthStore } from '@/lib/store/auth-store';
import { apiFetch } from '@/lib/api-fetch';
import { uploadPicktyImages } from '@/lib/image-upload-api';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { captureTemplateThumbnail2x2 } from '@/lib/template-thumbnail-composite';
import { createTemplate, getTemplate, templatePayloadToTierItems } from '@/lib/tier-api';
import {
  stripFilenameToDefaultName,
  templateNewFormSchema,
  type TemplateNewFormValues,
} from '@/lib/schemas/template-new';
import { PICKTY_IMAGE_ACCEPT } from '@/lib/pickty-image-accept';
import { PICKTY_IMAGE_UPLOAD_HINT } from '@/lib/pickty-upload-hint';
import {
  buildTemplateBoardConfigFromEditorState,
  cloneTemplateBoardConfig,
  createDefaultTemplateBoardConfig,
  templateBoardConfigToApiPayload,
} from '@/lib/template-board-config';
import { type TierItem, useTierStore } from '@/lib/store/tier-store';
import { useTierPersistHydrated } from '@/lib/hooks/use-tier-persist-hydrated';
import { TierBoard } from '@/components/tier/tier-board';
import { TierItemTileImages } from '@/components/tier/tier-item-tile-images';
import { ImagePreviewModal } from '@/components/tier/image-preview-modal';
import { TemplateBoardCanvasEditor } from '@/components/template/template-board-canvas-editor';

import { Sparkles, Loader2, Plus, AlertCircle } from 'lucide-react';

type FileEntry = { file: File; previewUrl: string };

type AiTemplateItemResponse = {
  id: string;
  name: string;
  imageUrl: string;
  focusRect?: { x: number; y: number; w: number; h: number };
};

function newClientId(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    /* non-secure context */
  }
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function NewTemplatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forkTemplateIdTrimmed = searchParams.get('forkTemplateId')?.trim() ?? '';
  const hydrated = useAuthPersistHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileMap, setFileMap] = useState<Record<string, FileEntry>>({});
  const [dragOver, setDragOver] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedInfo, setSavedInfo] = useState<{
    id: string;
    title: string;
    itemCount: number;
  } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customThumbFile, setCustomThumbFile] = useState<File | null>(null);
  const [customThumbPreview, setCustomThumbPreview] = useState<string | null>(null);
  const customThumbInputRef = useRef<HTMLInputElement>(null);
  const userEditedThumbsRef = useRef(false);
  const prevItemIdsKeyRef = useRef('');
  const [persistedListThumbnailUrl, setPersistedListThumbnailUrl] = useState<string | null>(null);
  const [keepOriginalThumb, setKeepOriginalThumb] = useState(false);
  const [forkLoadError, setForkLoadError] = useState<string | null>(null);
  const tierHydrated = useTierPersistHydrated();
  const [boardPointerReady, setBoardPointerReady] = useState(false);

  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  const form = useForm<TemplateNewFormValues>({
    resolver: zodResolver(templateNewFormSchema),
    defaultValues: {
      title: '',
      description: '',
      items: [],
      thumbnailClientIds: [],
    },
    mode: 'onSubmit',
  });

  const { register } = form;
  useEffect(() => {
    register('thumbnailClientIds');
  }, [register]);

  const watchedItems = useWatch({ control: form.control, name: 'items' }) ?? [];
  const itemIdsKey = watchedItems.map((r) => r.clientId).join('\0');

  useEffect(() => {
    if (customThumbFile) {
      const u = URL.createObjectURL(customThumbFile);
      setCustomThumbPreview(u);
      return () => URL.revokeObjectURL(u);
    }
    setCustomThumbPreview(null);
    return undefined;
  }, [customThumbFile]);

  useEffect(() => {
    const rows = form.getValues('items');
    const ids = rows.map((r) => r.clientId).filter(Boolean);
    if (ids.length === 0) {
      form.setValue('thumbnailClientIds', []);
      if (prevItemIdsKeyRef.current !== '') {
        userEditedThumbsRef.current = false;
      }
      prevItemIdsKeyRef.current = '';
      return;
    }
    const keyChanged = itemIdsKey !== prevItemIdsKeyRef.current;
    prevItemIdsKeyRef.current = itemIdsKey;

    if (!userEditedThumbsRef.current) {
      form.setValue('thumbnailClientIds', ids.slice(0, 4), { shouldDirty: false });
      return;
    }

    const cur = form.getValues('thumbnailClientIds') ?? [];
    const cleaned = cur.filter((id: string) => ids.includes(id)).slice(0, 4);
    if (keyChanged || cleaned.join(',') !== cur.join(',')) {
      form.setValue('thumbnailClientIds', cleaned, { shouldDirty: false });
    }
  }, [itemIdsKey, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const revokePreview = useCallback((clientId: string) => {
    setFileMap((prev) => {
      const entry = prev[clientId];
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      const next = { ...prev };
      delete next[clientId];
      return next;
    });
  }, []);

  useEffect(() => {
    const map = fileMap;
    return () => {
      for (const e of Object.values(map)) {
        URL.revokeObjectURL(e.previewUrl);
      }
    };
  }, [fileMap]);

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) {
      setIsAdmin(false);
      return;
    }
    void apiFetch('/api/v1/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((u: { role?: string } | null) => setIsAdmin(u?.role === 'ADMIN'))
      .catch(() => setIsAdmin(false));
  }, [hydrated, accessToken]);

  useEffect(() => {
    queueMicrotask(() => setBoardPointerReady(true));
  }, []);

  useEffect(() => {
    if (!tierHydrated || !hydrated || !accessToken) return;
    if (forkTemplateIdTrimmed) return;
    useTierStore.getState().initTemplateBoardEditor(createDefaultTemplateBoardConfig());
  }, [tierHydrated, hydrated, accessToken, forkTemplateIdTrimmed]);

  useEffect(() => {
    if (!hydrated || !accessToken || !forkTemplateIdTrimmed) {
      setForkLoadError(null);
      if (!forkTemplateIdTrimmed) setPersistedListThumbnailUrl(null);
      return;
    }
    let cancelled = false;
    setForkLoadError(null);
    useTierStore.getState().initTemplateBoardEditor(createDefaultTemplateBoardConfig());
    void (async () => {
      try {
        const d = await getTemplate(forkTemplateIdTrimmed, accessToken ?? null);
        if (cancelled) return;
        const pool = templatePayloadToTierItems(d.items);
        if (pool.length === 0) {
          setForkLoadError('템플릿에 아이템이 없습니다.');
          return;
        }
        const descRaw = d.items.description;
        const description =
          typeof descRaw === 'string' && descRaw.trim() ? descRaw.trim() : undefined;
        const rows = pool.map((p) => ({
          clientId: newClientId(),
          name: p.name,
          existingImageUrl: p.imageUrl,
          focusRect: p.focusRect,
        }));
        form.reset({
          title: d.title,
          description: description ?? '',
          items: rows,
          thumbnailClientIds: rows.slice(0, 4).map((r) => r.clientId),
        });
        setFileMap({});
        setCustomThumbFile(null);
        setKeepOriginalThumb(false);
        setPersistedListThumbnailUrl(d.thumbnailUrl ?? null);
        userEditedThumbsRef.current = false;
        prevItemIdsKeyRef.current = rows.map((r) => r.clientId).join('\0');
        useTierStore.getState().initTemplateBoardEditor(
          d.boardConfig
            ? cloneTemplateBoardConfig(d.boardConfig)
            : createDefaultTemplateBoardConfig(),
        );
      } catch (e) {
        if (!cancelled) {
          setForkLoadError(e instanceof Error ? e.message : '템플릿을 불러오지 못했습니다.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken, forkTemplateIdTrimmed, form]);

  const ingestFiles = useCallback(
    (list: FileList | File[]) => {
      const arr = Array.from(list).filter((f) => f.type.startsWith('image/'));
      if (arr.length === 0) return;
      for (const file of arr) {
        const clientId = newClientId();
        const previewUrl = URL.createObjectURL(file);
        setFileMap((prev) => ({ ...prev, [clientId]: { file, previewUrl } }));
        append({ clientId, name: stripFilenameToDefaultName(file.name) });
      }
    },
    [append],
  );

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    if (!accessToken) {
      setAiError('로그인이 필요합니다.');
      return;
    }

    setAiError(null);
    setIsAiGenerating(true);
    try {
      const resp = await apiFetch('/api/v1/ai/generate-items', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          requireCount: 20,
          excludeItems: watchedItems.map((it) => it.name).filter(Boolean),
        }),
      });

      if (!resp.ok) {
        throw new Error('AI 아이템 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }

      const items: AiTemplateItemResponse[] = await resp.json();
      if (items.length === 0) {
        setAiError('생성된 아이템이 없습니다. 다른 주제로 시도해 보세요.');
        return;
      }

      for (const item of items) {
        append({
          clientId: newClientId(),
          name: item.name,
          existingImageUrl: item.imageUrl,
          focusRect: item.focusRect,
        });
      }
      setAiPrompt('');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 생성 중 오류가 발생했습니다.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const formTierEntriesForPool = useMemo((): TierItem[] => {
    const out: TierItem[] = [];
    for (let i = 0; i < watchedItems.length; i++) {
      const row = watchedItems[i]!;
      const cid = row.clientId;
      if (!cid) continue;
      const local = fileMap[cid]?.previewUrl;
      const existing = row.existingImageUrl?.trim();
      const src = local ?? (existing ? picktyImageDisplaySrc(existing) : '');
      if (!src) continue;
      out.push({
        id: cid,
        name: (typeof row.name === 'string' && row.name.trim()) || '아이템',
        imageUrl: src,
        focusRect: row.focusRect,
      });
    }
    return out;
  }, [watchedItems, fileMap]);

  const poolSyncKey = useMemo(
    () => formTierEntriesForPool.map((p) => `${p.id}:${p.imageUrl}`).join('|'),
    [formTierEntriesForPool],
  );

  useEffect(() => {
    if (!tierHydrated || !accessToken) return;
    useTierStore.getState().syncTemplatePreviewPoolFromForm(formTierEntriesForPool);
  }, [tierHydrated, accessToken, poolSyncKey, formTierEntriesForPool]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) ingestFiles(files);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) ingestFiles(e.dataTransfer.files);
  };

  const removeRow = (index: number) => {
    const row = form.getValues(`items.${index}`);
    if (row?.clientId) revokePreview(row.clientId);
    remove(index);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    if (!accessToken) {
      setSubmitError('로그인이 필요합니다.');
      return;
    }

    const primaryThumbIds =
      values.thumbnailClientIds && values.thumbnailClientIds.length > 0
        ? values.thumbnailClientIds
        : (form.getValues('thumbnailClientIds') ?? []);

    const persistedThumbTrimmed = persistedListThumbnailUrl?.trim() ?? '';
    const useOriginalForkThumb =
      Boolean(forkTemplateIdTrimmed) && keepOriginalThumb && Boolean(persistedThumbTrimmed);

    if (!useOriginalForkThumb && !customThumbFile) {
      if (values.items.length < 4) {
        setSubmitError('썸네일을 등록하지 않았어요. 썸네일을 자동으로 만들기 위해 아이템을 4개 선택(체크)해 주세요.');
        return;
      }
      if (primaryThumbIds.length !== 4) {
        setSubmitError('썸네일을 등록하지 않았어요. 썸네일을 자동으로 만들기 위해 아이템을 4개 선택(체크)해 주세요.');
        return;
      }
    }

    const imageUrlsOrdered: string[] = [];
    for (const row of values.items) {
      const file = fileMap[row.clientId]?.file;
      if (file) {
        try {
          const [u] = await uploadPicktyImages([file], accessToken);
          if (!u) {
            setSubmitError('이미지 업로드에 실패했습니다.');
            return;
          }
          imageUrlsOrdered.push(u);
        } catch (e) {
          setSubmitError(e instanceof Error ? e.message : '이미지 업로드에 실패했습니다.');
          return;
        }
      } else if (row.existingImageUrl?.trim()) {
        imageUrlsOrdered.push(row.existingImageUrl.trim());
      } else {
        setSubmitError('일부 아이템에 이미지가 없습니다. 파일을 다시 넣거나 해당 행을 제거해 주세요.');
        return;
      }
    }

    const itemsPayload = values.items.map((row, i) => ({
      id: row.clientId,
      name: row.name.trim(),
      imageUrl: imageUrlsOrdered[i]!,
      focusRect: row.focusRect,
    }));

    const itemsEnvelope: {
      description?: string;
      items: typeof itemsPayload;
    } = { items: itemsPayload };
    if (values.description) {
      itemsEnvelope.description = values.description;
    }

    const urlByClientId: Record<string, string> = {};
    for (let i = 0; i < values.items.length; i++) {
      urlByClientId[values.items[i]!.clientId] = imageUrlsOrdered[i]!;
    }

    const thumbClientIds = primaryThumbIds;
    const orderedThumbIds = values.items
      .map((r) => r.clientId)
      .filter((id) => thumbClientIds.includes(id));

    const intendedAutoThumb =
      !useOriginalForkThumb && !customThumbFile && thumbClientIds.length === 4;

    let finalThumbnailUrl: string | null = null;
    if (useOriginalForkThumb) {
      finalThumbnailUrl = persistedThumbTrimmed;
    } else if (customThumbFile) {
      try {
        const customUrls = await uploadPicktyImages([customThumbFile], accessToken);
        finalThumbnailUrl = customUrls[0] ?? null;
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : '썸네일 업로드에 실패했습니다.');
        return;
      }
    } else if (orderedThumbIds.length === 4) {
      const four = orderedThumbIds.map((id) => urlByClientId[id]).filter(Boolean);
      if (four.length === 4) {
        try {
          const blob = await captureTemplateThumbnail2x2(four);
          const pngFile = new File([blob], 'template-thumbnail.png', { type: 'image/png' });
          const [u] = await uploadPicktyImages([pngFile], accessToken);
          finalThumbnailUrl = u ?? null;
        } catch (e) {
          setSubmitError(
            e instanceof Error
              ? e.message
              : '썸네일 자동 만들기에 실패했습니다. 다시 시도하거나 썸네일을 직접 올려 보세요.',
          );
          return;
        }
      } else {
        setSubmitError('선택한 4개 중 이미지가 비어 있는 항목이 있습니다. 모두 이미지를 넣은 뒤 다시 저장해 주세요.');
        return;
      }
    }

    try {
      const payload = {
        title: values.title.trim(),
        parentTemplateId: forkTemplateIdTrimmed || null,
        version: 1,
        items: itemsEnvelope,
        thumbnailUrl: finalThumbnailUrl ?? null,
        boardConfig: templateBoardConfigToApiPayload(
          buildTemplateBoardConfigFromEditorState(
            useTierStore.getState().tiers,
            useTierStore.getState().workspaceBoardSurface,
          ),
        ),
      };
      const created = await createTemplate(payload, accessToken);
      if (
        finalThumbnailUrl &&
        created.thumbnailFieldInResponse &&
        (created.thumbnailUrl == null || String(created.thumbnailUrl).trim() === '')
      ) {
        setSubmitError(
          '템플릿은 저장됐지만 서버에 썸네일 URL이 비어 있습니다. 백엔드를 최신으로 맞추고 DB에 tier_templates.thumbnail_url 컬럼이 있는지 확인해 주세요.',
        );
        return;
      }
      setSavedInfo({
        id: created.id,
        title: values.title.trim(),
        itemCount: itemsPayload.length,
      });
      setPersistedListThumbnailUrl(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    }
  });

  if (!hydrated) {
    return (
      <div className="w-full py-20 flex justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="w-full py-10 px-1 sm:px-2">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">새 템플릿 만들기</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            템플릿 등록은 로그인 후 이용할 수 있습니다.
          </p>
          <Link
            href="/login?returnTo=/tier/template/new"
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 transition-colors"
          >
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  if (savedInfo) {
    return (
      <div className="w-full py-10 px-1 sm:px-2 max-w-lg mx-auto">
        <div
          role="status"
          className="rounded-xl border-2 border-emerald-400/80 dark:border-emerald-600/80 bg-emerald-50 dark:bg-emerald-950/40 p-6 shadow-sm"
        >
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">저장 완료</p>
          <h1 className="mt-2 text-xl font-bold text-slate-900 dark:text-zinc-100">{savedInfo.title}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
            아이템 {savedInfo.itemCount}개가 들어간 템플릿을 저장했어요. 아래에서 바로 티어표를 만들어 보세요.
          </p>
          {isAdmin && (
            <p className="mt-3 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              [관리자] 이미지는 <strong>Cloudflare R2</strong>에 올라가며 메타에는 공개 URL(
              <code className="text-[0.7rem] bg-white/60 dark:bg-black/30 px-1 rounded">https://img.pickty.app/…</code>
              )이 기록됩니다. CORS 설정이 맞아야 다른 오리진에서 미리보기·캡처가 됩니다.
            </p>
          )}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(`/tier?templateId=${encodeURIComponent(savedInfo.id)}`)
              }
              className="inline-flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 transition-colors"
            >
              티어표 만들기
            </button>
            <Link
              href="/tier/templates"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 text-sm font-medium px-5 py-2.5 transition-colors text-center"
            >
              템플릿 목록 보기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const submitting = form.formState.isSubmitting;
  const showForkOriginalThumbOption =
    Boolean(forkTemplateIdTrimmed) && Boolean(persistedListThumbnailUrl?.trim());
  const thumbPickerActive = !customThumbFile && !keepOriginalThumb;

  return (
    <>
      {submitting && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-[2px] px-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div
              className="h-11 w-11 shrink-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin"
              aria-hidden
            />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">저장 중입니다</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                {PICKTY_IMAGE_UPLOAD_HINT} 저장까지 이어서 진행 중이에요.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full py-8 px-1 sm:px-2">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          {forkTemplateIdTrimmed ? '템플릿을 받아와서 새로 만들기' : '새 템플릿 만들기'}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          이미지를 올려 티어표에 넣을 아이템을 만듭니다. 이름은 파일명을 기준으로 채워지며 바꿀 수 있어요.
        </p>
        {forkTemplateIdTrimmed && (
          <p className="mt-2 text-xs text-violet-600 dark:text-violet-400 leading-relaxed">
            기존 템플릿의 아이템을 그대로 불러왔어요. 빠진 항목을 추가하거나 필요 없는 건 지워서 나만의 템플릿으로
            만들어 보세요.
          </p>
        )}
      </div>

      {forkLoadError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {forkLoadError}
        </div>
      )}

      {isAdmin && (
        <div
          role="note"
          className="mb-6 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50/90 dark:bg-zinc-900/60 px-3 py-2 text-xs text-slate-700 dark:text-zinc-300"
        >
          [관리자] 저장 시 이미지는 서버를 거쳐 <strong>Cloudflare R2</strong>에 올라갑니다. 미리보기는 브라우저에서만 쓰이며, 공개 URL은{' '}
          <code className="text-[0.65rem] opacity-90">https://img.pickty.app/…</code> 형식으로 저장됩니다.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-8" aria-busy={submitting}>
        <div className="space-y-2">
          <label
            htmlFor="template-title"
            className="block text-sm font-medium text-slate-800 dark:text-zinc-200"
          >
            템플릿 제목 <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            id="template-title"
            type="text"
            autoComplete="off"
            maxLength={100}
            placeholder="예: 내 최애 캐릭터 티어"
            className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 dark:focus:border-violet-500 transition-colors"
            {...form.register('title')}
          />
          {form.formState.errors.title && (
            <p className="text-sm text-red-600 dark:text-red-400">{form.formState.errors.title.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="template-desc"
            className="block text-sm font-medium text-slate-800 dark:text-zinc-200"
          >
            템플릿 설명 <span className="text-slate-400 dark:text-zinc-600 font-normal">(선택)</span>
          </label>
          <textarea
            id="template-desc"
            rows={3}
            maxLength={10000}
            placeholder="이 템플릿에 대한 짧은 설명"
            className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 dark:focus:border-violet-500 transition-colors resize-y min-h-[4.5rem]"
            {...form.register('description')}
          />
          {form.formState.errors.description && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {form.formState.errors.description.message as string}
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/40 p-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
              썸네일 등록하기 <span className="text-slate-400 dark:text-zinc-600 font-normal">(선택)</span>
            </span>
            {showForkOriginalThumbOption && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-950/40 px-3 py-2.5 text-sm text-slate-800 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={keepOriginalThumb}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setKeepOriginalThumb(on);
                    if (on) setCustomThumbFile(null);
                  }}
                  className="mt-0.5 rounded border-slate-400 text-violet-600 focus:ring-violet-500/40"
                />
                <span>기존 템플릿 썸네일 그대로 사용하기</span>
              </label>
            )}
            {keepOriginalThumb && showForkOriginalThumbOption ? (
              <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                불러온 썸네일을 그대로 씁니다. 새로 올리거나 아이템으로 자동으로 만들려면 위 체크를 해제해 주세요.
              </p>
            ) : showForkOriginalThumbOption ? (
              <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                새 썸네일을 올리거나, 아래 아이템 중 4개를 골라 자동으로 만들 수 있어요.
              </p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                따로 올리지 않으면, 아래 업로드 아이템 중 4개를 고르시면 자동으로 만들어 드려요.
              </p>
            )}
            <div
              className={[
                'flex flex-wrap items-center gap-3',
                keepOriginalThumb && showForkOriginalThumbOption ? 'pointer-events-none opacity-50' : '',
              ].join(' ')}
              aria-hidden={keepOriginalThumb && showForkOriginalThumbOption}
            >
              <input
                ref={customThumbInputRef}
                type="file"
                accept={PICKTY_IMAGE_ACCEPT}
                className="sr-only"
                disabled={keepOriginalThumb && showForkOriginalThumbOption}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setCustomThumbFile(f ?? null);
                  if (f) {
                    setPersistedListThumbnailUrl(null);
                    setKeepOriginalThumb(false);
                  }
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={keepOriginalThumb && showForkOriginalThumbOption}
                onClick={() => customThumbInputRef.current?.click()}
                className="text-xs font-medium rounded-lg border border-slate-300 dark:border-zinc-600 px-3 py-2 text-slate-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-colors disabled:pointer-events-none disabled:opacity-50"
              >
                이미지 선택
              </button>
              {customThumbFile && (
                <button
                  type="button"
                  disabled={keepOriginalThumb && showForkOriginalThumbOption}
                  onClick={() => setCustomThumbFile(null)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:pointer-events-none disabled:opacity-50"
                >
                  썸네일 제거
                </button>
              )}
            </div>
            {customThumbPreview && (
              <div className="relative mt-2 h-24 w-24 overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-700">
                <TierItemTileImages imageUrl={customThumbPreview} alt="썸네일 미리보기" />
              </div>
            )}
            {!customThumbFile && persistedListThumbnailUrl && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-slate-500 dark:text-zinc-500">불러온 템플릿 썸네일</p>
                <div className="relative h-28 w-28 overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-700">
                  <TierItemTileImages
                    imageUrl={persistedListThumbnailUrl.trim()}
                    alt="불러온 템플릿 썸네일"
                  />
                </div>
                {showForkOriginalThumbOption && keepOriginalThumb ? (
                  <p className="text-xs text-slate-500 dark:text-zinc-500">이대로 저장 시 이 썸네일이 그대로 쓰여요.</p>
                ) : null}
                {showForkOriginalThumbOption && !keepOriginalThumb ? (
                  <p className="text-xs text-slate-500 dark:text-zinc-500">
                    이 썸네일을 사용하시려면, 위의 [기존 템플릿 썸네일 그대로 사용하기] 를 체크해주세요.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="block text-sm font-medium text-slate-800 dark:text-zinc-200">
              아이템 이미지 <span className="text-red-500 dark:text-red-400">*</span>
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 dark:bg-violet-950/30 text-[0.7rem] font-bold text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/50">
              <Sparkles className="w-3 h-3" />
              AI 딸깍 (베타)
            </div>
          </div>

          <div className="rounded-xl border border-violet-100 dark:border-violet-900/40 bg-white dark:bg-zinc-950 p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="주제 입력 (예: 블루아카이브 학생들, 포켓몬 1세대...)"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={isAiGenerating}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleAiGenerate();
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 pl-3 pr-10 py-2.5 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-colors"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={isAiGenerating || !aiPrompt.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:pointer-events-none text-white text-sm font-semibold px-5 py-2.5 transition-colors whitespace-nowrap"
              >
                {isAiGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    AI로 아이템 20개 생성
                  </>
                )}
              </button>
            </div>
            
            <p className="text-[0.7rem] text-slate-500 dark:text-zinc-500 leading-relaxed">
              아이템 이름과 이미지를 구글 검색을 통해 자동으로 가져옵니다. <strong>약 10~30초</strong> 정도 소요될 수 있으며, 생성된 결과는 아래 목록에 추가됩니다.
            </p>

            {aiError && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-[0.7rem] text-red-800 dark:text-red-300 border border-red-100 dark:border-red-900/50">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}
          </div>

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={[
              'rounded-xl border-2 border-dashed cursor-pointer transition-colors px-4 py-10 text-center',
              dragOver
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                : 'border-slate-300 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/60 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-slate-50 dark:hover:bg-zinc-900',
            ].join(' ')}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={PICKTY_IMAGE_ACCEPT}
              multiple
              className="sr-only"
              onChange={onInputChange}
            />
            <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">
              이미지를 드래그하거나 이 영역을 클릭해 여러 장 선택
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
              파일명(확장자 제외)이 기본 아이템 이름으로 들어갑니다.
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">
              {PICKTY_IMAGE_UPLOAD_HINT}
            </p>
          </div>

          {form.formState.errors.items?.message && (
            <p className="text-sm text-red-600 dark:text-red-400">{form.formState.errors.items.message}</p>
          )}
          {form.formState.errors.items?.root?.message && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {form.formState.errors.items.root.message}
            </p>
          )}
        </div>

        {fields.length > 0 && (
          <div className="space-y-2">
            {thumbPickerActive && (
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                썸네일 이미지를 따로 올리지 않았다면, 아래 목록에서 썸네일로 묶어줄 아이템 {' '}
                <span className="font-medium text-slate-800 dark:text-zinc-200">4개</span>를 {' '}
                선택(체크)해 주세요.
              </p>
            )}
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {fields.map((field, index) => {
                const clientId = form.watch(`items.${index}.clientId`);
                const existingImg = form.watch(`items.${index}.existingImageUrl`);
                const rowName = form.watch(`items.${index}.name`);
                const previewLocal = clientId ? fileMap[clientId]?.previewUrl : undefined;
                const existingTrimmed =
                  typeof existingImg === 'string' && existingImg.trim() ? existingImg.trim() : '';
                const rawImageUrl = previewLocal ?? existingTrimmed;
                const rowFocusRect = form.watch(`items.${index}.focusRect`);
                const itemAlt =
                  (typeof rowName === 'string' && rowName.trim()) || `아이템 ${index + 1}`;
                const picked = (form.watch('thumbnailClientIds') ?? []).includes(clientId ?? '');
                const thumbCount = (form.watch('thumbnailClientIds') ?? []).length;
                return (
                  <li
                    key={field.id}
                    className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col"
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-zinc-950">
                      {rawImageUrl ? (
                        <TierItemTileImages
                          imageUrl={rawImageUrl}
                          alt={itemAlt}
                          focusRect={rowFocusRect}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 dark:text-zinc-600">
                          미리보기 없음
                        </div>
                      )}
                    </div>
                    <div className="p-2 flex flex-col gap-2 flex-1">
                      <input type="hidden" {...form.register(`items.${index}.clientId`)} />
                      <input type="hidden" {...form.register(`items.${index}.existingImageUrl`)} />
                      {thumbPickerActive && (
                        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={picked}
                            disabled={!clientId}
                            onChange={() => {
                              if (!clientId) return;
                              userEditedThumbsRef.current = true;
                              const cur = form.getValues('thumbnailClientIds') ?? [];
                              if (picked) {
                                form.setValue(
                                  'thumbnailClientIds',
                                  cur.filter((id) => id !== clientId),
                                  { shouldDirty: true },
                                );
                              } else if (cur.length < 4) {
                                form.setValue('thumbnailClientIds', [...cur, clientId], { shouldDirty: true });
                              }
                            }}
                            className="rounded border-slate-400 text-violet-600 focus:ring-violet-500/40"
                          />
                          썸네일
                          {!picked && thumbCount >= 4 ? (
                            <span className="text-slate-400 dark:text-zinc-600">(4개 한도)</span>
                          ) : null}
                        </label>
                      )}
                      <input
                        type="text"
                        aria-label={`아이템 ${index + 1} 이름`}
                        maxLength={100}
                        className="w-full rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                        {...form.register(`items.${index}.name`)}
                      />
                      {form.formState.errors.items?.[index]?.name && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {form.formState.errors.items[index]?.name?.message}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="mt-auto text-xs font-medium text-red-600 dark:text-red-400 hover:underline py-1"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {tierHydrated ? (
          <>
            <TemplateBoardCanvasEditor formTierEntries={formTierEntriesForPool} />
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
                  실시간 미리보기 및 체험
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                  위에서 만든 도화지가 그대로 반영됩니다. 미분류 풀에서 티어로 끌어다 놓아 보세요.
                </p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <TierBoard variant="template-preview" pointerModeReady={boardPointerReady} />
              </div>
            </div>
            <ImagePreviewModal />
          </>
        ) : (
          <div className="flex justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-500">
            보드 불러오는 중…
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-200"
          >
            {submitError}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:pointer-events-none dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 transition-colors min-w-[9.5rem]"
          >
            {submitting ? (
              <>
                <span
                  className="h-4 w-4 shrink-0 rounded-full border-2 border-white/70 border-t-transparent animate-spin"
                  aria-hidden
                />
                저장 중…
              </>
            ) : (
              '템플릿 저장'
            )}
          </button>
          <Link
            href="/tier/templates"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 text-sm font-medium px-5 py-2.5 transition-colors"
          >
            취소
          </Link>
        </div>
      </form>
      </div>
    </>
  );
}

export default function NewTemplatePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full py-20 flex justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <NewTemplatePageInner />
    </Suspense>
  );
}
