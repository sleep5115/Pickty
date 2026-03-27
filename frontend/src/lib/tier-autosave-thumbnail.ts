/**
 * 비로그인 → 로그인/가입 자동 저장 플로우용.
 * 로그인 전에는 R2 업로드가 불가하므로, 캡처 미리보기(blob URL)를 Data URL로 sessionStorage에 두고
 * 토큰 발급 후 업로드한다.
 */
export const TIER_AUTOSAVE_THUMB_SESSION_KEY = 'pickty-tier-autosave-thumb-dataurl';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** export 모달의 object URL 미리보기를 sessionStorage에 저장 */
export async function stashTierAutoSaveThumbnailFromPreviewUrl(previewUrl: string | null): Promise<void> {
  if (typeof window === 'undefined' || !previewUrl?.trim()) {
    return;
  }
  try {
    const res = await fetch(previewUrl);
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    sessionStorage.setItem(TIER_AUTOSAVE_THUMB_SESSION_KEY, dataUrl);
  } catch {
    sessionStorage.removeItem(TIER_AUTOSAVE_THUMB_SESSION_KEY);
  }
}

export function clearTierAutoSaveThumbnailStash(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TIER_AUTOSAVE_THUMB_SESSION_KEY);
}
