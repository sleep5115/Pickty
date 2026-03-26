import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const onboardingSchema = z.object({
  nickname: z
    .string()
    .min(2, { message: '닉네임은 최소 2자 이상이어야 합니다.' })
    .max(20, { message: '닉네임은 최대 20자까지 입력 가능합니다.' }),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  birthYear: z.number().int().min(1900).max(currentYear).optional(),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
