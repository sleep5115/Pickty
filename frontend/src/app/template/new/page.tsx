'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/lib/store/auth-store';
import { apiFetch } from '@/lib/api-fetch';
import { uploadPicktyImages } from '@/lib/image-upload-api';
import { createTemplate } from '@/lib/tier-api';
import {
  stripFilenameToDefaultName,
  templateNewFormSchema,
  type TemplateNewFormValues,
} from '@/lib/schemas/template-new';

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

export default function NewTemplatePage() {
  const router = useRouter();
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
  }, [accessToken]);

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

    const orderedFiles: File[] = [];
    for (const row of values.items) {
      const file = fileMap[row.clientId]?.file;
      if (!file) {
        setSubmitError('일부 이미지 파일이 없습니다. 해당 아이템을 제거 후 다시 시도해 주세요.');
        return;
      }
      orderedFiles.push(file);
    }

    let imageUrls: string[];
    try {
      imageUrls = await uploadPicktyImages(orderedFiles, accessToken);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '이미지 업로드에 실패했습니다.');
      return;
    }

    const itemsPayload = values.items.map((row, i) => ({
      id: row.clientId,
      name: row.name.trim(),
      imageUrl: imageUrls[i]!,
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
      urlByClientId[values.items[i]!.clientId] = imageUrls[i]!;
    }
    /** 체크한 썸네일 id 는 setValue 로만 갱신돼 있어 zod/제출 payload 에 빠질 수 있음 → getValues 사용 */
    const thumbClientIds = form.getValues('thumbnailClientIds') ?? [];
    const orderedThumbIds = values.items
      .map((r) => r.clientId)
      .filter((id) => thumbClientIds.includes(id));
    let thumbnailUrls: string[] = orderedThumbIds.map((id) => urlByClientId[id]!).filter(Boolean);
    if (customThumbFile) {
      let customUrls: string[];
      try {
        customUrls = await uploadPicktyImages([customThumbFile], accessToken);
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : '커스텀 썸네일 업로드에 실패했습니다.');
        return;
      }
      const first = customUrls[0];
      if (first) {
        thumbnailUrls = [first, ...thumbnailUrls].slice(0, 4);
      }
    } else {
      thumbnailUrls = thumbnailUrls.slice(0, 4);
    }

    try {
      const created = await createTemplate(
        {
          title: values.title.trim(),
          parentTemplateId: null,
          version: 1,
          items: itemsEnvelope,
          thumbnailUrls,
        },
        accessToken,
      );
      setSavedInfo({
        id: created.id,
        title: values.title.trim(),
        itemCount: itemsPayload.length,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    }
  });

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
          새 템플릿 만들기
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          이미지를 올려 티어표에 넣을 아이템을 만듭니다. 이름은 파일명을 기준으로 채워지며 바꿀 수 있어요.
        </p>
      </div>

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
              썸네일을 따로 등록하지 않으면, 아래 아이템 이미지에서 4장을 골라 목록 카드용 썸네일을 만들어요.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={customThumbInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setCustomThumbFile(f ?? null);
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
              accept="image/*"
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
                목록 카드 썸네일로 쓸 아이템을 <span className="font-medium text-slate-800 dark:text-zinc-200">최대 4개</span>
                까지 체크하세요. 새로 이미지를 넣으면 앞에서부터 자동으로 체크돼요.
              </p>
            )}
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {fields.map((field, index) => {
                const clientId = form.watch(`items.${index}.clientId`);
                const preview = clientId ? fileMap[clientId]?.previewUrl : undefined;
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
