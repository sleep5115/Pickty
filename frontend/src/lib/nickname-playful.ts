/** 백엔드 `CustomOAuth2UserService` 기본 닉네임과 동일한 단어 풀 (온보딩 랜덤 재생성용) */
export const PLAYFUL_NICKNAME_ADJECTIVES = [
  '무시무시한',
  '수상한',
  '말랑한',
  '배고픈',
  '용감한',
  '촉촉한',
  '포근한',
  '힙한',
  '은밀한',
  '즐거운',
] as const;

export const PLAYFUL_NICKNAME_NOUNS = [
  '바지',
  '오징어',
  '젤리',
  '거북이',
  '푸딩',
  '다람쥐',
  '고양이',
  '감자',
  '찌개',
  '도토리',
] as const;

function randomInt(maxExclusive: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]! % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

/** 형용사+명사 (백엔드 기본 닉네임과 동일 규칙, 중복 허용 — 접미사 없음) */
export function generateRandomPlayfulNickname(): string {
  const adj = PLAYFUL_NICKNAME_ADJECTIVES[randomInt(PLAYFUL_NICKNAME_ADJECTIVES.length)]!;
  const noun = PLAYFUL_NICKNAME_NOUNS[randomInt(PLAYFUL_NICKNAME_NOUNS.length)]!;
  return `${adj}${noun}`;
}
