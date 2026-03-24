import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email({ message: '올바른 이메일 형식이 아닙니다.' }),
  password: z.string().min(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' }),
});

const currentYear = new Date().getFullYear();

export const onboardingSchema = z.object({
  nickname: z
    .string()
    .min(2, { message: '닉네임은 최소 2자 이상이어야 합니다.' })
    .max(20, { message: '닉네임은 최대 20자까지 입력 가능합니다.' }),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  birthYear: z.number().int().min(1900).max(currentYear).optional(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
