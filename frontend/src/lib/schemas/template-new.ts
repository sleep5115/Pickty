import { z } from 'zod';

const templateItemRowSchema = z.object({
  clientId: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(1, { message: '아이템 이름을 입력해 주세요.' })
    .max(100, { message: '이름은 100자 이하로 입력해 주세요.' }),
  /** `forkTemplateId`로 불러온 기존 이미지 URL — 새 파일이 있으면 업로드로 대체 */
  existingImageUrl: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t && t.length > 0 ? t : undefined;
    }),
});

export const templateNewFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: '템플릿 제목을 입력해 주세요.' })
    .max(100, { message: '제목은 100자 이하로 입력해 주세요.' }),
  description: z
    .string()
    .max(10000, { message: '설명은 10000자 이하로 입력해 주세요.' })
    .optional()
    .transform((v) => {
      const t = (v ?? '').trim();
      return t.length > 0 ? t : undefined;
    }),
  items: z
    .array(templateItemRowSchema)
    .min(1, { message: '이미지를 1개 이상 추가해 주세요.' }),
  /** 썸네일로 쓸 아이템 clientId — RHF register/setValue 전용 */
  thumbnailClientIds: z.array(z.string()).max(4).optional(),
});

export type TemplateNewFormValues = z.input<typeof templateNewFormSchema>;

export function stripFilenameToDefaultName(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, '');
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) {
    return base.trim() || 'item';
  }
  const stem = base.slice(0, dot).trim();
  return stem.length > 0 ? stem : 'item';
}
