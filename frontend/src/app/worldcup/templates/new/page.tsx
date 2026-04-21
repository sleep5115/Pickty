'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Control } from 'react-hook-form';
import { FormProvider, useFieldArray, useForm, useFormContext, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Camera, Layers, Loader2, Plus, Table2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { WorldCupBulkAddModal } from '@/components/worldcup/worldcup-bulk-add-modal';
import { WorldCupEditorMediaPreview } from '@/components/worldcup/worldcup-editor-media-preview';
import { createWorldCupTemplate } from '@/lib/worldcup/worldcup-template-api';
import {
  fetchYoutubeOembedTitle,
  parseYoutubeVideoId,
  stripUploadedImageBaseName,
  suggestItemNameFromUrl,
} from '@/lib/worldcup/worldcup-media-url';
import { createWorldCupCompositeThumbnail } from '@/lib/worldcup/worldcup-thumbnail-composite';
import { uploadPicktyImages } from '@/lib/image-upload-api';
import { PICKTY_IMAGE_ACCEPT } from '@/lib/pickty-image-accept';
import { PICKTY_IMAGE_UPLOAD_HINT } from '@/lib/pickty-upload-hint';
import { useAuthStore } from '@/lib/store/auth-store';

const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, '이름을 입력해 주세요.').max(100),
  imageUrl: z.string().max(2048).optional().or(z.literal('')),
  /** UI 전용 — 직접 업로드 시 URL 입력 숨김 */
  mediaEntryKind: z.enum(['url', 'upload']),
});

const formSchema = z.object({
  title: z.string().min(1, '제목을 입력해 주세요.').max(100),
  description: z.string().max(10000).optional().or(z.literal('')),
  layoutMode: z.enum(['split_diagonal', 'split_lr']),
  items: z.array(itemSchema).min(2, '최소 2개의 후보를 등록해 주세요'),
});

type FormValues = z.infer<typeof formSchema>;

function newItemRow(): FormValues['items'][number] {
  return {
    id:
      typeof crypto !== 'undefined'
        ? crypto.randomUUID()
        : `wc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: '',
    imageUrl: '',
    mediaEntryKind: 'url',
  };
}

/** 사선: 좌상·우하 직사각형이 가운데에서 살짝 겹침 */
function IconDiagonalSplit({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M3 3.5 h11 v11 H3 z"
        className="fill-current opacity-95"
      />
      <path
        d="M10 10 h11 v11 H10 z"
        className="fill-current opacity-65"
      />
    </svg>
  );
}

/** 좌우 50:50 (세로로 갈라진 두 직사각형) */
function IconSplitLeftRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M3 3.5 h8.5 v17 H3 z" className="fill-current opacity-95" />
      <path d="M12.5 3.5 H21 v17 h-8.5 z" className="fill-current opacity-65" />
    </svg>
  );
}

function ItemPreviewCell({
  index,
  control,
}: {
  index: number;
  control: Control<FormValues>;
}) {
  const url = useWatch({
    control,
    name: `items.${index}.imageUrl`,
    defaultValue: '',
  });
  return <WorldCupEditorMediaPreview url={typeof url === 'string' ? url : ''} />;
}

function ItemThumbnailUploadCell({ index }: { index: number }) {
  const { register, setValue, control, formState } = useFormContext<FormValues>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageUrl = useWatch({ control, name: `items.${index}.imageUrl` }) ?? '';

  const onPickFile = () => {
    fileRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!accessToken) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    void (async () => {
      try {
        const [url] = await uploadPicktyImages([file], accessToken);
        setValue(`items.${index}.imageUrl`, url, { shouldDirty: true, shouldValidate: true });
        setValue(`items.${index}.name`, stripUploadedImageBaseName(file.name), {
          shouldValidate: true,
        });
        setValue(`items.${index}.mediaEntryKind`, 'upload', { shouldValidate: true });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '업로드에 실패했습니다.');
      }
    })();
  };

  const err = formState.errors.items?.[index]?.imageUrl;

  return (
    <div className="flex flex-col items-center gap-1">
      <input type="hidden" {...register(`items.${index}.id`)} />
      <input type="hidden" {...register(`items.${index}.mediaEntryKind`)} />
      <input
        ref={fileRef}
        type="file"
        accept={PICKTY_IMAGE_ACCEPT}
        className="sr-only"
        onChange={onFileChange}
      />
      <button
        type="button"
        onClick={onPickFile}
        disabled={!accessToken}
        title={accessToken ? '클릭하여 이미지 업로드' : '로그인 후 업로드할 수 있어요'}
        className="group relative flex size-[3.75rem] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/80 transition hover:border-violet-400 hover:bg-violet-50/80 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900/60 dark:hover:border-violet-500 dark:hover:bg-violet-950/40"
      >
        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="rounded-full bg-black/55 p-1.5 text-white shadow dark:bg-black/70">
            <Camera className="size-4" aria-hidden />
          </span>
        </span>
        {imageUrl.trim() ? (
          <ItemPreviewCell index={index} control={control} />
        ) : (
          <span className="flex size-14 flex-col items-center justify-center gap-0.5 text-slate-400 dark:text-zinc-500">
            <Plus className="size-7 stroke-[1.75]" aria-hidden />
            <span className="text-[9px] font-medium leading-none">업로드</span>
          </span>
        )}
      </button>
      {err?.message ? (
        <p className="max-w-[5rem] text-center text-[10px] text-red-600 dark:text-red-400">{err.message}</p>
      ) : null}
    </div>
  );
}

function ItemMediaUrlField({ index }: { index: number }) {
  const { register, setValue, control } = useFormContext<FormValues>();
  const mediaEntryKind = useWatch({ control, name: `items.${index}.mediaEntryKind` }) ?? 'url';
  const imageUrl = useWatch({ control, name: `items.${index}.imageUrl` }) ?? '';

  const r = register(`items.${index}.imageUrl`);

  if (mediaEntryKind === 'upload' && imageUrl.trim()) {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <input type="hidden" {...r} />
        <span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-100">
          <span aria-hidden>✓</span>
          이미지 직접 업로드 완료
        </span>
        <button
          type="button"
          className="w-fit text-left text-xs font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
          onClick={() => {
            setValue(`items.${index}.mediaEntryKind`, 'url', { shouldValidate: true });
            setValue(`items.${index}.imageUrl`, '', { shouldValidate: true });
          }}
        >
          외부 URL 입력으로 바꾸기
        </button>
      </div>
    );
  }

  return (
    <input
      type="text"
      {...r}
      onBlur={async (e) => {
        await r.onBlur(e);
        const v = e.target.value.trim();
        if (parseYoutubeVideoId(v)) {
          const t = await fetchYoutubeOembedTitle(v);
          if (t) {
            setValue(`items.${index}.name`, t, { shouldValidate: true });
          }
        }
      }}
      className="w-full min-w-[200px] rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
      placeholder="https://… (이미지·움짤·유튜브)"
      spellCheck={false}
    />
  );
}

export default function WorldCupTemplateNewPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [savedInfo, setSavedInfo] = useState<{ id: string; title: string; itemCount: number } | null>(
    null,
  );
  const batchImageInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      layoutMode: 'split_diagonal',
      items: [newItemRow()],
    },
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = form;

  const { fields, remove, append } = useFieldArray({ control, name: 'items' });

  const onSubmit = async (data: FormValues) => {
    if (!accessToken) {
      setError('root', { message: '로그인이 필요합니다.' });
      return;
    }
    try {
      let thumbnailUrl: string | null = null;
      try {
        const compositeBlob = await createWorldCupCompositeThumbnail(
          data.items.map((it) => ({ imageUrl: it.imageUrl })),
        );
        const thumbnailFile = new File([compositeBlob], 'worldcup-thumbnail.png', {
          type: 'image/png',
        });
        const uploadResult = await uploadPicktyImages([thumbnailFile], accessToken);
        thumbnailUrl = uploadResult[0] ?? null;
      } catch {
        thumbnailUrl = null;
      }

      const created = await createWorldCupTemplate(
        {
          title: data.title.trim(),
          description: data.description?.trim() ? data.description.trim() : null,
          layoutMode: data.layoutMode,
          thumbnailUrl,
          items: data.items.map((it) => ({
            id: it.id,
            name: it.name.trim(),
            imageUrl: it.imageUrl?.trim() ? it.imageUrl.trim() : null,
          })),
        },
        accessToken,
      );
      setSavedInfo({
        id: created.id,
        title: data.title.trim(),
        itemCount: data.items.length,
      });
    } catch (e) {
      setError('root', {
        message: e instanceof Error ? e.message : '저장에 실패했습니다.',
      });
    }
  };

  const appendBulkUrls = async (urls: string[]) => {
    const enriched = await Promise.all(
      urls.map(async (raw) => {
        const trimmed = raw.trim();
        let name = suggestItemNameFromUrl(trimmed);
        if (parseYoutubeVideoId(trimmed)) {
          const t = await fetchYoutubeOembedTitle(trimmed);
          if (t) name = t;
        }
        return { trimmed, name };
      }),
    );
    for (const { trimmed, name } of enriched) {
      append({
        id:
          typeof crypto !== 'undefined'
            ? crypto.randomUUID()
            : `wc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        imageUrl: trimmed,
        mediaEntryKind: 'url',
      });
    }
  };

  const onBatchImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (!accessToken) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    const n = files.length;
    void toast.promise(
      (async () => {
        const urls = await uploadPicktyImages(files, accessToken);
        for (let i = 0; i < files.length; i++) {
          const f = files[i]!;
          const url = urls[i];
          if (!url) continue;
          append({
            id:
              typeof crypto !== 'undefined'
                ? crypto.randomUUID()
                : `wc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: stripUploadedImageBaseName(f.name),
            imageUrl: url,
            mediaEntryKind: 'upload',
          });
        }
      })(),
      {
        loading: `이미지 ${n}장 업로드 중…`,
        success: `이미지 ${n}장을 추가했어요.`,
        error: (err) => (err instanceof Error ? err.message : '업로드에 실패했습니다.'),
      },
    );
  };

  if (savedInfo) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-4 py-8 sm:px-6 md:px-8">
        <div className="mx-auto w-full max-w-lg">
          <div
            role="status"
            className="rounded-xl border-2 border-emerald-400/80 bg-emerald-50 p-6 shadow-sm dark:border-emerald-600/80 dark:bg-emerald-950/40"
          >
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">저장 완료</p>
            <h1 className="mt-2 text-xl font-bold text-slate-900 dark:text-zinc-100">{savedInfo.title}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              후보 {savedInfo.itemCount}개가 들어간 월드컵 템플릿을 저장했어요. 아래에서 바로 플레이해 보세요.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push(`/worldcup/templates/${encodeURIComponent(savedInfo.id)}`)}
                className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                바로 플레이하기
              </button>
              <Link
                href="/worldcup/templates"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                월드컵 목록
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-8 sm:px-6 md:px-8">
      {isSubmitting ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div
              className="h-11 w-11 shrink-0 animate-spin rounded-full border-2 border-violet-500 border-t-transparent"
              aria-hidden
            />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">저장 중입니다</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                {PICKTY_IMAGE_UPLOAD_HINT} 썸네일 합성·저장까지 이어서 진행 중이에요.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-10">
          <Link
            href="/worldcup/templates"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-violet-600 dark:text-zinc-400 dark:hover:text-violet-400"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            월드컵 목록
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            월드컵 템플릿 만들기
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            위에서는 제목·설명·레이아웃을 정하고, 아래 표에서 후보 미디어를 대량으로 붙여 넣거나 행별로
            다듬을 수 있습니다.
          </p>
        </div>

        {!accessToken ? (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
            로그인 후 저장할 수 있습니다.{' '}
            <Link
              href="/login?returnTo=/worldcup/templates/new"
              className="font-semibold underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-50"
            >
              로그인하기
            </Link>
          </div>
        ) : null}

        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-10">
            {/* —— 상단: 기본 정보 —— */}
            <section
              className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-200/60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:ring-white/5"
              aria-labelledby="wc-section-meta"
            >
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                  <Layers className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 id="wc-section-meta" className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                    템플릿 기본 정보
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-500">
                    목록 카드와 플레이 화면 상단에 쓰이는 메타입니다.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="flex flex-col gap-4 lg:col-span-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">제목</span>
                    <input
                      type="text"
                      autoComplete="off"
                      {...register('title')}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                      placeholder="예: 2026 최애 월드컵"
                    />
                    {errors.title ? (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.title.message}</p>
                    ) : null}
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">설명 (선택)</span>
                    <textarea
                      {...register('description')}
                      rows={3}
                      className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                      placeholder="템플릿을 소개하는 짧은 문구"
                    />
                    {errors.description ? (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.description.message}</p>
                    ) : null}
                  </label>
                </div>

                <fieldset className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 lg:col-span-2 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <legend className="px-1 text-sm font-medium text-slate-800 dark:text-zinc-200">
                    대진 화면 레이아웃
                  </legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white bg-white p-3 shadow-sm has-[:checked]:border-violet-500 has-[:checked]:ring-2 has-[:checked]:ring-violet-500/25 dark:border-zinc-700 dark:bg-zinc-900 dark:has-[:checked]:border-violet-500">
                      <input
                        type="radio"
                        value="split_diagonal"
                        {...register('layoutMode')}
                        className="mt-1"
                      />
                      <span className="flex items-start gap-3">
                        <IconDiagonalSplit className="mt-0.5 size-7 shrink-0 text-violet-600 dark:text-violet-400" />
                        <span>
                          <span className="block text-sm font-medium text-slate-900 dark:text-zinc-100">
                            대각 배치
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-500">
                            좌상·우하 대각 배치
                          </span>
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white bg-white p-3 shadow-sm has-[:checked]:border-violet-500 has-[:checked]:ring-2 has-[:checked]:ring-violet-500/25 dark:border-zinc-700 dark:bg-zinc-900 dark:has-[:checked]:border-violet-500">
                      <input type="radio" value="split_lr" {...register('layoutMode')} className="mt-1" />
                      <span className="flex items-start gap-3">
                        <IconSplitLeftRight className="mt-0.5 size-7 shrink-0 text-violet-600 dark:text-violet-400" />
                        <span>
                          <span className="block text-sm font-medium text-slate-900 dark:text-zinc-100">
                            좌우 배치
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-500">
                            좌우 분할 배치
                          </span>
                        </span>
                      </span>
                    </label>
                  </div>
                  {errors.layoutMode ? (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errors.layoutMode.message}</p>
                  ) : null}
                </fieldset>
              </div>
            </section>

            {/* —— 하단: 후보 테이블 —— */}
            <section
              className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-200/60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:ring-white/5"
              aria-labelledby="wc-section-items"
            >
              <input
                ref={batchImageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={onBatchImagesChange}
              />
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
                    <Table2 className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h2 id="wc-section-items" className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                      후보 아이템
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-500">
                      썸네일을 눌러 업로드하거나, URL·일괄 추가로 등록할 수 있습니다.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => batchImageInputRef.current?.click()}
                    disabled={!accessToken}
                    className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 shadow-sm hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-700/50 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-950/70"
                  >
                    이미지 일괄 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkOpen(true)}
                    className="inline-flex items-center justify-center rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 shadow-sm hover:bg-violet-100 dark:border-violet-600/50 dark:bg-violet-950/50 dark:text-violet-200 dark:hover:bg-violet-950/80"
                  >
                    일괄 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => append(newItemRow())}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Plus className="size-4" aria-hidden />
                    행 추가
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                      <th className="w-12 px-3 py-3 text-center">#</th>
                      <th className="w-[92px] px-2 py-3">미리보기</th>
                      <th className="min-w-[140px] px-3 py-3">이름</th>
                      <th className="min-w-[260px] px-3 py-3">미디어 URL</th>
                      <th className="w-24 px-2 py-3 text-center">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => (
                      <tr
                        key={field.id}
                        className="border-b border-slate-100 odd:bg-white even:bg-slate-50/50 last:border-0 dark:border-zinc-800 dark:odd:bg-zinc-900/40 dark:even:bg-zinc-900/70"
                      >
                        <td className="px-3 py-3 text-center font-mono text-xs text-slate-500 tabular-nums dark:text-zinc-500">
                          {index + 1}
                        </td>
                        <td className="px-2 py-3 align-middle">
                          <ItemThumbnailUploadCell index={index} />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <input
                            type="text"
                            {...register(`items.${index}.name`)}
                            className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                            placeholder="표시 이름"
                          />
                          {errors.items?.[index]?.name ? (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                              {errors.items[index]?.name?.message}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <ItemMediaUrlField index={index} />
                          {errors.items?.[index]?.imageUrl ? (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                              {errors.items[index]?.imageUrl?.message}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-2 py-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 2}
                            className="inline-flex items-center justify-center rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/40"
                            aria-label={`행 ${index + 1} 삭제`}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {errors.items && typeof errors.items.message === 'string' ? (
                <p className="mt-3 text-xs text-red-600 dark:text-red-400">{errors.items.message}</p>
              ) : null}
            </section>

            {errors.root?.message ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {errors.root.message}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-2 dark:border-zinc-800">
              <button
                type="submit"
                disabled={isSubmitting || !accessToken}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    저장 중…
                  </>
                ) : (
                  '저장하기'
                )}
              </button>
              <Link
                href="/worldcup/templates"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                취소
              </Link>
            </div>
          </form>
        </FormProvider>
      </div>

      <WorldCupBulkAddModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onApply={appendBulkUrls}
      />
    </div>
  );
}
