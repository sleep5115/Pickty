# Pickty 배포·연동 테스트 체크리스트

운영 도메인: **https://pickty.app** · API: **https://api.pickty.app** · 이미지 CDN: **https://img.pickty.app**

---

## 0. 백엔드 시크릿·코드 배포 (Lightsail)

| 구분 | 레포 | 비고 |
|------|------|------|
| **코드·Docker 이미지** | Pickty | `main` → `.github/workflows/deploy-backend.yml` — TLS Secret + 서버 `git pull` + compose `--build`. 서버에 `application-secrets.yaml` 이 없으면 이 단계에서 실패. |
| **운영 `application-secrets.yaml`** | pickty-config | `main` 에 해당 파일만 변경 push → `.github/workflows/deploy-secrets.yml` — SCP 후 `pickty-api` 만 `restart`. Pickty 와 동일 SSH Secrets 를 pickty-config GitHub 저장소에도 등록. |

자세한 트리거·경로는 Pickty **`deploy/lightsail/README.md`** 참고.

---

## 1. 배포 전 최종 점검 (Pre-deployment)

| 검증 항목 | 기대값 | 확인 방법 |
|-----------|--------|-----------|
| 프론트 API 베이스 | `https://api.pickty.app` | `frontend/src/lib/public-site-config.ts` 의 `PUBLIC_API_BASE_URL` fallback 및 Vercel `NEXT_PUBLIC_API_URL` |
| 프론트 사이트 URL | `https://pickty.app` | `PUBLIC_SITE_URL` 및 `NEXT_PUBLIC_SITE_URL` |
| 백엔드 `FRONTEND_URL` | `https://pickty.app` | `pickty-config/application-secrets.yaml` 또는 서버 환경 변수 |
| 백엔드 CORS 허용 오리진 | `https://pickty.app`, `https://www.pickty.app`, 로컬 3002 | 동일 파일의 `app.oauth2.allowed-frontend-origins` (쉼표 구분, 공백 없이) |
| R2 공개 URL | `https://img.pickty.app` | `cloud.cloudflare.r2.public-url` 이 업로드 응답 URL과 일치 |
| Mixed Content | HTTPS 페이지에서 API·이미지 모두 `https://` | 브라우저 주소창이 `https://pickty.app` 일 때 Network 탭에 `http://` 요청 없음 |

**정합성**: 프론트가 부르는 API 호스트와 백엔드 실제 공개 URL이 같아야 하며, OAuth 리다이렉트 대상 오리진은 반드시 CORS·`allowed-frontend-origins` 에 포함되어야 합니다.

---

## 2. Google OAuth — 콘솔에 넣을 값 (복사용)

**OAuth 클라이언트 유형**: 웹 애플리케이션

### 승인된 리디렉션 URI (Authorized redirect URIs)

Spring Security 기본 콜백 경로:

```
https://api.pickty.app/login/oauth2/code/google
```

### 승인된 JavaScript 생성자 (Authorized JavaScript origins)

```
https://pickty.app
https://www.pickty.app
http://localhost:3002
http://127.0.0.1:3002
```

코드 내 동일 안내: `OAuth2SuccessHandler.kt` KDoc, `login/page.tsx` 주석.

---

## 3. R2 이미지(`img.pickty.app`) 확인

### 코드 내 `pub-…r2.dev` 하드코딩

레포 내 추적 파일 기준 **고정 pub-xxx URL 없음**. `*.r2.dev` 는 **레거시 URL 호환**용(`public-site-config.ts`, `next.config.ts`)만 사용.

### 터미널에서 응답 헤더 확인 (객체 키는 실제 업로드된 파일명으로 교체)

```bash
curl -sI "https://img.pickty.app/여기에-실제-객체-키"
```

기대: `200` 또는 객체가 없으면 `404`(둘 다 TLS·도메인 정상). `403`이면 R2/버킷 정책·커스텀 도메인을 점검.

### npm 스크립트 (배포 후 로컬에서)

```bash
cd frontend
npm run verify:deploy
```

환경 변수로 덮어쓰기: `VERIFY_API_BASE`, `VERIFY_IMAGE_BASE`, 선택 `VERIFY_IMAGE_PATH`(업로드해 둔 객체 키).

해석 가이드: API가 **521/502/connection error** 이면 `api.pickty.app` 프록시·백엔드 기동을 먼저 확인. `img.pickty.app/` 루트 **HEAD** 가 **403/404** 여도 TLS·DNS가 살아 있는 경우가 많음 — 실제 객체 URL(`VERIFY_IMAGE_PATH`)으로 다시 확인.

---

## 4. Vercel 환경 변수

| Key | Value (Production 권장) | 비고 |
|-----|-------------------------|------|
| `NEXT_PUBLIC_API_URL` | `https://api.pickty.app` | API fetch·OAuth 팝업 시작 URL |
| `NEXT_PUBLIC_SITE_URL` | `https://pickty.app` | 사이트 canonical 용도(코드 fallback과 일치) |
| `NEXT_PUBLIC_PICKTY_IMAGE_HOSTS` | (비워두기) | 추가 이미지 호스트가 있을 때만 쉼표 구분 |

**Preview 브랜치**: Vercel preview URL을 백엔드 CORS에 넣지 않으면 API가 403일 수 있음. 필요 시 `allowed-frontend-origins`에 preview 도메인 추가 또는 별도 preview용 API 프로필.

---

## 5. 배포 후 브라우저 점검

1. **Mixed Content**  
   - DevTools → **Console**: `Mixed Content` 문자열 검색.  
   - **Network**: 필터 `http` — `pickty.app` 페이지에서 나가는 비보안 요청이 없어야 함.

2. **CORS / 403**  
   - Network에서 `api.pickty.app` XHR/fetch 선택 → **Headers**에 `access-control-allow-origin` 이 요청 `Origin`과 맞는지 확인.  
   - 로그인·템플릿 목록 등 API가 **403**이면 백엔드 `allowed-frontend-origins`·실제 요청 `Origin`(www 유무 포함) 불일치 가능.

3. **OAuth**  
   - `https://pickty.app/login` → Google → 콜백이 `https://pickty.app/auth/callback?token=...` 로 끝나는지.  
   - 콘솔에 `redirect_uri_mismatch` 가 나오면 Google 콘솔 리디렉션 URI를 위 절과 정확히 맞출 것.

4. **이미지**  
   - 템플릿 썸네일·티어 카드가 깨지면 Network에서 `img.pickty.app` 요청 상태·R2 CORS 확인.

---

## 수동 작업 (지금 하시면 좋은 것)

1. **Google Cloud Console**: 승인된 리디렉션 URI에 `https://api.pickty.app/login/oauth2/code/google` 추가.  
2. **Vercel**: `NEXT_PUBLIC_API_URL` = `https://api.pickty.app` (및 위 표 참고).

이후 Vercel 재배포 → 위 **5번** 순서로 확인하면 됩니다.
