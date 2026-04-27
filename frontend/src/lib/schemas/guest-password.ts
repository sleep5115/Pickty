import { z } from 'zod';

/** 비회원 비밀번호 필드 — 프론트·백엔드 메시지와 동일하게 유지 */
export const GUEST_PASSWORD_INPUT_MESSAGE = '비밀번호를 입력해주세요.';

/** trim 후 4~128자(평문). 비회원 글/댓글/삭제 확인 등에 공통 사용 */
export const guestPasswordPlainSchema = z
  .string()
  .trim()
  .min(4, GUEST_PASSWORD_INPUT_MESSAGE)
  .max(128, GUEST_PASSWORD_INPUT_MESSAGE);
