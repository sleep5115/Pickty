/**
 * 배포 후 로컬 터미널에서 API·이미지 도메인 응답을 빠르게 확인.
 * 사용: npm run verify:deploy
 * 선택: VERIFY_API_BASE, VERIFY_IMAGE_BASE, VERIFY_IMAGE_PATH
 */

const apiBase = (process.env.VERIFY_API_BASE || 'https://api.pickty.app').replace(/\/$/, '');
const imageBase = (process.env.VERIFY_IMAGE_BASE || 'https://img.pickty.app').replace(/\/$/, '');
const imagePath = process.env.VERIFY_IMAGE_PATH || '';

async function head(url, label) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    console.log(`[${label}] ${res.status} ${url}`);
  } catch (e) {
    console.error(`[${label}] FAIL ${url}`, e?.message || e);
  }
}

async function getJson(url, label) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    console.log(`[${label}] ${res.status} ${url}`);
  } catch (e) {
    console.error(`[${label}] FAIL ${url}`, e?.message || e);
  }
}

console.log('Pickty verify:deploy — API:', apiBase, '| CDN:', imageBase);
await getJson(`${apiBase}/api/v1/templates`, 'API GET /api/v1/templates (CORS는 브라우저에서만 검증)');
if (imagePath) {
  await head(`${imageBase}/${imagePath.replace(/^\//, '')}`, 'R2 object HEAD');
} else {
  await head(`${imageBase}/`, 'R2 root HEAD (404여도 TLS·도메인 동작 확인용)');
}
