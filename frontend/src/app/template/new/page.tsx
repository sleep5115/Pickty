'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/lib/store/auth-store';
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

  const form = useForm<TemplateNewFormValues>({
    resolver: zodResolver(templateNewFormSchema),
    defaultValues: {
      title: '',
      description: '',
      items: [],
    },
    mode: 'onSubmit',
  });

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
        setSubmitError('일부 이미지 파일이 없습니다. 해당 항목을 제거 후 다시 시도해 주세요.');
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

    try {
      const created = await createTemplate(
        {
          title: values.title.trim(),
          parentTemplateId: null,
          version: 1,
          items: itemsEnvelope,
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
            템플릿이 서버(DB)에 등록되었습니다. 아이템 {savedInfo.itemCount}개가 포함되었습니다.
          </p>
          <p className="mt-3 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
            이미지는 <strong>Cloudflare R2</strong> 버킷에 올라가며, DB에는 공개 URL(
            <code className="text-[0.7rem] bg-white/60 dark:bg-black/30 px-1 rounded">https://img.pickty.app/파일명</code>
            )이 저장됩니다. R2 버킷 CORS가 맞게 열려 있어야 다른 오리진에서도 미리보기·캡처가 됩니다.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(`/tier?templateId=${encodeURIComponent(savedInfo.id)}`)
              }
              className="inline-flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 transition-colors"
            >
              티어 메이커로 이동
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

  return (
    <div className="w-full py-8 px-1 sm:px-2">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
          새 템플릿 만들기
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          이미지를 올려 티어표 재료(밀키트)를 만듭니다. 이름은 파일명에서 자동으로 채워지며 수정할 수 있습니다.
        </p>
      </div>

      <div
        role="note"
        className="mb-6 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50/90 dark:bg-zinc-900/60 px-3 py-2 text-xs text-slate-700 dark:text-zinc-300"
      >
        저장 시 이미지는 백엔드를 거쳐 <strong>Cloudflare R2</strong>에 업로드됩니다. 미리보기는 브라우저(blob)를 쓰며, DB에는{' '}
        <code className="text-[0.65rem] opacity-90">https://img.pickty.app/파일명</code> 형태의 공개 URL이 기록됩니다.
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
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
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {fields.map((field, index) => {
              const clientId = form.watch(`items.${index}.clientId`);
              const preview = clientId ? fileMap[clientId]?.previewUrl : undefined;
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
                    <input
                      type="hidden"
                      {...form.register(`items.${index}.clientId`)}
                    />
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
            disabled={form.formState.isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:pointer-events-none dark:bg-violet-600 dark:hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 transition-colors"
          >
            {form.formState.isSubmitting ? '업로드·저장 중…' : '이미지 업로드 후 템플릿 저장'}
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
  );
}
