import fs from 'node:fs';
import path from 'node:path';

export type LegalDocFilename = 'TERMS_OF_SERVICE_KO.md' | 'PRIVACY_POLICY_KO.md';

/**
 * `frontend/content/legal/`에 둔 마크다운을 읽습니다(배포·Turbopack 추적 범위에 맞춤).
 * 루트의 동명 파일을 수정했다면 `npm run sync:legal`로 동기화하세요.
 */
export function readLegalDoc(filename: LegalDocFilename): string {
  const bundled = path.join(process.cwd(), 'content', 'legal', filename);
  if (fs.existsSync(bundled)) {
    return fs.readFileSync(bundled, 'utf-8');
  }
  throw new Error(
    `법률 문서를 찾을 수 없습니다: ${filename}. 루트 약관을 수정했다면 frontend에서 npm run sync:legal 을 실행하세요.`,
  );
}

/** 공개 페이지에는 "(내부 참고)" 이하 제외 */
export function stripInternalLegalNotes(source: string): string {
  const marker = '\n---\n\n### (내부 참고)';
  const idx = source.indexOf(marker);
  if (idx === -1) return source;
  return source.slice(0, idx).trimEnd();
}
