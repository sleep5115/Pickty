'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthPersistHydrated } from '@/lib/hooks/use-auth-persist-hydrated';
import { useAuthStore } from '@/lib/store/auth-store';
import { apiFetch } from '@/lib/api-fetch';
import { uploadPicktyImages } from '@/lib/image-upload-api';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { captureTemplateThumbnail2x2 } from '@/lib/template-thumbnail-composite';
import {
  createTemplate,
  getTemplate,
  templatePayloadToTierItems,
  updateTemplate,
} from '@/lib/tier-api';
import {
  stripFilenameToDefaultName,
  templateNewFormSchema,
  type TemplateNewFormValues,
} from '@/lib/schemas/template-new';
import { PICKTY_IMAGE_ACCEPT } from '@/lib/pickty-image-accept';

type FileEntry = { file: File; previewUrl: string };

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
  const fromTemplateId = searchParams.get('fromTemplate');
  const editTemplateId = searchParams.get('editTemplate');
  const templateSourceId = editTemplateId ?? fromTemplateId;
  const isEditMode = Boolean(editTemplateId);
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
  const [forkLoadError, setForkLoadError] = useState<string | null>(null);

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
    if (!hydrated || !accessToken || !templateSourceId) {
      setForkLoadError(null);
      if (!templateSourceId) setPersistedListThumbnailUrl(null);
      return;
    }
    let cancelled = false;
    setForkLoadError(null);
    void (async () => {
      try {
        const d = await getTemplate(templateSourceId);
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
        }));
        form.reset({
          title: d.title,
          description: description ?? '',
          items: rows,
          thumbnailClientIds: rows.slice(0, 4).map((r) => r.clientId),
        });
        setFileMap({});
        setCustomThumbFile(null);
        setPersistedListThumbnailUrl(d.thumbnailUrl ?? null);
        userEditedThumbsRef.current = false;
        prevItemIdsKeyRef.current = rows.map((r) => r.clientId).join('\0');
      } catch (e) {
        if (!cancelled) {
          setForkLoadError(e instanceof Error ? e.message : '템플릿을 불러오지 못했습니다.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken, templateSourceId, form]);

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

    if (!customThumbFile) {
      if (values.items.length < 4) {
        setSubmitError('썸네일을 올리지 않으면 아이템이 4개 이상 있어야 합니다.');
        return;
      }
      if (primaryThumbIds.length !== 4) {
        setSubmitError('4개를 선택(체크)해 주세요.');
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

    const intendedAutoThumb = !customThumbFile && thumbClientIds.length === 4;

    let finalThumbnailUrl: string | null = null;
    if (customThumbFile) {
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

    if (intendedAutoThumb && !finalThumbnailUrl) {
      setSubmitError('썸네일을 올리지 않았다면 이미지 4개를 선택해 주세요.');
      return;
    }

    try {
      const payload = {
        title: values.title.trim(),
        parentTemplateId: null,
        version: 1,
        items: itemsEnvelope,
        thumbnailUrl: finalThumbnailUrl ?? null,
      };
      const created = isEditMode && editTemplateId
        ? await updateTemplate(editTemplateId, payload, accessToken)
        : await createTemplate(payload, accessToken);
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
            href="/login?returnTo=/template/new"
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
              href="/templates"
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
                이미지를 서버에 올리고 템플릿을 저장하고 있어요. 장 수가 많으면 조금 걸릴 수 있어요.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full py-8 px-1 sm:px-2">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          {isEditMode ? '템플릿 수정' : fromTemplateId ? '템플릿 다시 만들기' : '새 템플릿 만들기'}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          이미지를 올려 티어표에 넣을 아이템을 만듭니다. 이름은 파일명을 기준으로 채워지며 바꿀 수 있어요.
        </p>
        {fromTemplateId && !isEditMode && (
          <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">
            기존 템플릿을 불러왔습니다. 저장하면 <strong>새 템플릿</strong>으로 등록됩니다.
          </p>
        )}
        {isEditMode && (
          <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">
            이 템플릿을 수정 중입니다. 저장하면 같은 템플릿이 갱신됩니다.
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
            <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              따로 올리지 않으면, 아래 업로드 아이템 중 4개를 고르시면 자동으로 만들어 드려요.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={customThumbInputRef}
                type="file"
                accept={PICKTY_IMAGE_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setCustomThumbFile(f ?? null);
                  if (f) setPersistedListThumbnailUrl(null);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => customThumbInputRef.current?.click()}
                className="text-xs font-medium rounded-lg border border-slate-300 dark:border-zinc-600 px-3 py-2 text-slate-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
              >
                이미지 선택
              </button>
              {customThumbFile && (
                <button
                  type="button"
                  onClick={() => setCustomThumbFile(null)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  썸네일 제거
                </button>
              )}
            </div>
            {customThumbPreview && (
              <div className="mt-2 relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700">
                <Image
                  src={customThumbPreview}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            {!customThumbFile && persistedListThumbnailUrl && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-slate-500 dark:text-zinc-500">불러온 템플릿 썸네일</p>
                <div className="relative w-28 h-28 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={picktyImageDisplaySrc(persistedListThumbnailUrl)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  저장 시 새로 올리거나 자동 생성하면 이 이미지를 덮어씁니다.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <span className="block text-sm font-medium text-slate-800 dark:text-zinc-200">
            아이템 이미지 <span className="text-red-500 dark:text-red-400">*</span>
          </span>

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
            {!customThumbFile && (
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                썸네일을 등록하지 않았다면, <span className="font-medium text-slate-800 dark:text-zinc-200">4개</span>를
                아래에서 선택(체크)해 주세요.
              </p>
            )}
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {fields.map((field, index) => {
                const clientId = form.watch(`items.${index}.clientId`);
                const existingImg = form.watch(`items.${index}.existingImageUrl`);
                const previewLocal = clientId ? fileMap[clientId]?.previewUrl : undefined;
                const preview =
                  previewLocal ??
                  (typeof existingImg === 'string' && existingImg.trim()
                    ? picktyImageDisplaySrc(existingImg.trim())
                    : undefined);
                const picked = (form.watch('thumbnailClientIds') ?? []).includes(clientId ?? '');
                const thumbCount = (form.watch('thumbnailClientIds') ?? []).length;
                return (
                  <li
                    key={field.id}
                    className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col"
                  >
                    <div className="aspect-square bg-slate-100 dark:bg-zinc-950 relative">
                      {preview ? (
                        <Image
                          src={preview}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-cover"
                          unoptimized
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
                      {!customThumbFile && (
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
            href="/templates"
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
