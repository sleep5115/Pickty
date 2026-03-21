import { z } from 'zod';

const templateItemRowSchema = z.object({
  clientId: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(1, { message: '아이템 이름을 입력해 주세요.' })
    .max(200, { message: '이름은 200자 이하로 입력해 주세요.' }),
});

export const templateNewFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: '템플릿 제목을 입력해 주세요.' })
    .max(500, { message: '제목은 500자 이하로 입력해 주세요.' }),
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
