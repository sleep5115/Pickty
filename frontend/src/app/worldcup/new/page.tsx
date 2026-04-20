'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Control } from 'react-hook-form';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Layers, LayoutList, Loader2, Plus, Rows3, Table2, Trash2 } from 'lucide-react';
import { WorldCupBulkAddModal } from '@/components/worldcup/worldcup-bulk-add-modal';
import { WorldCupEditorMediaPreview } from '@/components/worldcup/worldcup-editor-media-preview';
import { createWorldCupTemplate } from '@/lib/worldcup/worldcup-template-api';
import { suggestItemNameFromUrl } from '@/lib/worldcup/worldcup-media-url';
import { useAuthStore } from '@/lib/store/auth-store';

const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, '이름을 입력해 주세요.').max(100),
  imageUrl: z.string().max(2048).optional().or(z.literal('')),
});

const formSchema = z.object({
  title: z.string().min(1, '제목을 입력해 주세요.').max(100),
  description: z.string().max(10000).optional().or(z.literal('')),
  layoutMode: z.enum(['split_diagonal', 'split_lr']),
  /** UI 전용 — 서버에는 아직 미전달(목록 공개 정책 안내용) */
  acknowledgePublicListing: z.boolean().optional(),
  items: z.array(itemSchema).min(1, '아이템을 1개 이상 추가해 주세요.'),
});

type FormValues = z.infer<typeof formSchema>;

function newItemRow(): { id: string; name: string; imageUrl: string } {
  return {
    id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `wc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: '',
    imageUrl: '',
  };
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

export default function WorldCupTemplateNewPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [bulkOpen, setBulkOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      layoutMode: 'split_diagonal',
      acknowledgePublicListing: true,
      items: [newItemRow()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const onSubmit = async (data: FormValues) => {
    if (!accessToken) {
      setError('root', { message: '로그인이 필요합니다.' });
      return;
    }
    try {
      const created = await createWorldCupTemplate(
        {
          title: data.title.trim(),
          description: data.description?.trim() ? data.description.trim() : null,
          layoutMode: data.layoutMode,
          items: data.items.map((it) => ({
            id: it.id,
            name: it.name.trim(),
            imageUrl: it.imageUrl?.trim() ? it.imageUrl.trim() : null,
          })),
        },
        accessToken,
      );
      router.push(`/worldcup/${created.id}`);
    } catch (e) {
      setError('root', {
        message: e instanceof Error ? e.message : '저장에 실패했습니다.',
      });
    }
  };

  const appendBulkUrls = (urls: string[]) => {
    for (const raw of urls) {
      append({
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `wc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: suggestItemNameFromUrl(raw),
        imageUrl: raw.trim(),
      });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-8 sm:px-6 md:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-10">
          <Link
            href="/worldcup"
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
              href="/login?returnTo=/worldcup/new"
              className="font-semibold underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-50"
            >
              로그인하기
            </Link>
          </div>
        ) : null}

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

              <fieldset className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
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
                    <span className="flex items-start gap-2">
                      <LayoutList className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                      <span>
                        <span className="block text-sm font-medium text-slate-900 dark:text-zinc-100">
                          사선 50:50
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-500">
                          좌상·우하 대각 배치
                        </span>
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white bg-white p-3 shadow-sm has-[:checked]:border-violet-500 has-[:checked]:ring-2 has-[:checked]:ring-violet-500/25 dark:border-zinc-700 dark:bg-zinc-900 dark:has-[:checked]:border-violet-500">
                    <input type="radio" value="split_lr" {...register('layoutMode')} className="mt-1" />
                    <span className="flex items-start gap-2">
                      <Rows3 className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                      <span>
                        <span className="block text-sm font-medium text-slate-900 dark:text-zinc-100">
                          좌우 50:50
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-zinc-500">
                          좌우 분할 대결
                        </span>
                      </span>
                    </span>
                  </label>
                </div>
                {errors.layoutMode ? (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errors.layoutMode.message}</p>
                ) : null}
              </fieldset>

              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" {...register('acknowledgePublicListing')} className="mt-1 rounded border-slate-300" />
                  <span>
                    <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
                      목록에 공개
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-zinc-500">
                      저장하면 ACTIVE 상태로 월드컵 허브(`/worldcup`) 목록에 노출됩니다. 삭제 소프트 삭제
                      전까지 다른 사용자도 플레이할 수 있습니다.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* —— 하단: 후보 테이블 —— */}
          <section
            className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-200/60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:ring-white/5"
            aria-labelledby="wc-section-items"
          >
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
                    표에서 이름·URL을 바로 수정하고, 일괄 추가로 대량 등록할 수 있습니다.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                    <th className="w-[88px] px-2 py-3">미리보기</th>
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
                        <input type="hidden" {...register(`items.${index}.id`)} />
                        <ItemPreviewCell index={index} control={control} />
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
                        <input
                          type="text"
                          {...register(`items.${index}.imageUrl`)}
                          className="w-full min-w-[200px] rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs text-slate-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                          placeholder="https://… (이미지·움짤·유튜브)"
                          spellCheck={false}
                        />
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
                          disabled={fields.length <= 1}
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

            <p className="mt-4 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500">
              유튜브 URL은 저장 시에도 <code className="rounded bg-slate-100 px-1 dark:bg-zinc-800">imageUrl</code>에
              그대로 들어가며, 플레이 UI에서{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-zinc-800">worldcup-media-url</code> 유틸로 영상
              embed 여부를 판별할 수 있습니다.
            </p>
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
                '저장하고 플레이하기'
              )}
            </button>
            <Link
              href="/worldcup"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              취소
            </Link>
          </div>
        </form>
      </div>

      <WorldCupBulkAddModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onApply={(urls) => appendBulkUrls(urls)}
      />
    </div>
  );
}
