import { apiFetch } from '@/lib/api-fetch';

/**
 * 클라이언트 압축 후 업로드 — R2 부하·413 완화.
 * 서버·Nginx 요청당 본문 한도는 8MB로 통일(`application.yaml`, `deploy/lightsail/nginx.conf`).
 * 서버는 JPEG/PNG/WebP/GIF 화이트리스트 + 매직 검증.
 */
const PICKTY_CLIENT_COMPRESS_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
  fileType: 'image/webp' as const,
  /** 확대 모달 등에서 디테일 보존 */
  initialQuality: 0.85,
};

export type UploadPicktyImagesOptions = {
  /**
   * 압축 또는 업로드 실패 직전 호출 (토스트 등).
   * 기본 동작은 이후 throw 로 해당 배치 중단 — imageUrls[i] 정렬을 깨지 않기 위함.
   */
  onImageFailure?: (detail: { file: File; phase: 'compress' | 'upload'; error: unknown }) => void;
};

function webpUploadName(original: File): string {
  const raw = original.name?.trim();
  const base =
    raw && raw.length > 0
      ? raw.replace(/\.[^.\\/]+$/i, '').replace(/[/\\]/g, '_') || 'image'
      : 'image';
  return `${base}.webp`;
}

/**
 * 원본 File → WebP 로 압축. Web Worker 사용으로 메인 스레드 블로킹 완화.
 * 동적 import 로 `window`/canvas 의존 라이브러리 로드를 클라이언트 업로드 시점까지 지연.
 */
async function compressPicktyImageForUpload(file: File): Promise<File> {
  const imageCompression = (await import('browser-image-compression')).default;
  const out = await imageCompression(file, PICKTY_CLIENT_COMPRESS_OPTIONS);
  return new File([out], webpUploadName(file), {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}

/**
 * 이미지마다: [압축 WebP] → 별도 POST 순차 전송.
 * - 일부 리버스 프록시는 **요청당** 본문 한도가 있어 한 번에 여러 파일을 내면 413이 자주 납니다.
 * - 백엔드 `POST /api/v1/images`는 단일 `files` 파트(파일 1개)도 그대로 처리합니다.
 */
export async function uploadPicktyImages(
  files: File[],
  accessToken: string | null,
  options?: UploadPicktyImagesOptions,
): Promise<string[]> {
  if (files.length === 0) {
    throw new Error('업로드할 파일이 없습니다.');
  }
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const compressed: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const original = files[i]!;
    try {
      compressed.push(await compressPicktyImageForUpload(original));
    } catch (err) {
      console.error('[pickty] image compress failed', { index: i, name: original.name, err });
      options?.onImageFailure?.({ file: original, phase: 'compress', error: err });
      throw new Error(
        `이미지 압축에 실패했습니다. (${i + 1}번째${original.name ? `: ${original.name}` : ''})`,
      );
    }
  }

  const urls: string[] = [];
  for (let i = 0; i < compressed.length; i++) {
    const original = files[i]!;
    const fd = new FormData();
    fd.append('files', compressed[i]!);
    let res: Response;
    try {
      res = await apiFetch('/api/v1/images', {
        method: 'POST',
        headers,
        body: fd,
      });
    } catch (err) {
      console.error('[pickty] image upload failed', { index: i, err });
      options?.onImageFailure?.({ file: original, phase: 'upload', error: err });
      throw err instanceof Error
        ? err
        : new Error(`이미지 업로드에 실패했습니다. (${i + 1}번째 파일)`);
    }
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 413) {
        const err = new Error(
          '이 파일은 업로드 허용 크기를 넘었습니다. 다른 이미지로 바꿔 주시거나, 잠시 후 다시 시도해 주세요.',
        );
        options?.onImageFailure?.({ file: original, phase: 'upload', error: err });
        throw err;
      }
      const err = new Error(
        t || `이미지 업로드 실패 (${res.status}) — ${i + 1}번째 파일`,
      );
      options?.onImageFailure?.({ file: original, phase: 'upload', error: err });
      throw err;
    }
    const data = (await res.json()) as { urls?: string[] };
    if (!data.urls || data.urls.length !== 1) {
      const err = new Error(`업로드 응답 형식 오류 — ${i + 1}번째 파일`);
      options?.onImageFailure?.({ file: original, phase: 'upload', error: err });
      throw err;
    }
    urls.push(data.urls[0]!);
  }
  return urls;
}
