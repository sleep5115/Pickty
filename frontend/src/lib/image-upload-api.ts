import { apiFetch } from '@/lib/api-fetch';

/**
 * 이미지마다 별도 POST로 업로드합니다.
 * - 일부 리버스 프록시는 **요청당** 본문 크기 제한이 있어, 한 번에 여러 파일을 내면 413이 자주 납니다.
 * - 백엔드 `POST /api/v1/images`는 단일 `files` 파트(파일 1개)도 그대로 처리합니다.
 */
export async function uploadPicktyImages(files: File[], accessToken: string | null): Promise<string[]> {
  if (files.length === 0) {
    throw new Error('업로드할 파일이 없습니다.');
  }
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const fd = new FormData();
    fd.append('files', files[i]!);
    const res = await apiFetch('/api/v1/images', {
      method: 'POST',
      headers,
      body: fd,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(
        t || `이미지 업로드 실패 (${res.status}) — ${i + 1}번째 파일`,
      );
    }
    const data = (await res.json()) as { urls?: string[] };
    if (!data.urls || data.urls.length !== 1) {
      throw new Error(`업로드 응답 형식 오류 — ${i + 1}번째 파일`);
    }
    urls.push(data.urls[0]!);
  }
  return urls;
}
