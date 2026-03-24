import { redirect } from 'next/navigation';

/** 예전 북마크·링크 호환 */
export default function DashboardRedirectPage() {
  redirect('/account');
}
