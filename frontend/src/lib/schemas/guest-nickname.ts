import { z } from 'zod';

export const GUEST_NICKNAME_INPUT_MESSAGE = '닉네임을 입력해주세요.';

/** 비회원 표시 이름 — trim 후 2~10자(placeholder에서 길이 안내) */
export const guestNicknamePlainSchema = z
  .string()
  .trim()
  .min(2, GUEST_NICKNAME_INPUT_MESSAGE)
  .max(10, GUEST_NICKNAME_INPUT_MESSAGE);
