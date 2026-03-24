import { redirect } from 'next/navigation';

/** 일반 이메일 회원가입 UI는 제거. 구 `/signup` 북마크는 로그인으로 유도 */
export default function SignupPage() {
  redirect('/login');
}
