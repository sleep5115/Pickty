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
| API 이미지 업로드 본문 한도 | **8MB** (`client_max_body_size 8m`) | `deploy/lightsail/nginx.conf` 는 Spring `multipart`·Tomcat `maxPostSize` 와 **같은 수치**로 둔다. nginx 설정을 바꾼 뒤에는 서버에서 반영(reload) 필요. |

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

### OG·프록시 경로 캐시 헤더 (백엔드)

`GET https://api.pickty.app/api/v1/images/file/{key}` (또는 `?key=`) 응답에는 레포 기준 **`Cache-Control: public, max-age=31536000, immutable`** 가 붙는다. 배포 후 확인:

```bash
curl -sI "https://api.pickty.app/api/v1/images/file/실제-객체-키"
```

**`cache-control`** 에 `max-age=31536000`·`immutable` 포함 여부 확인. (nginx가 이 헤더를 덮어쓰지 않도록 `proxy_hide_header` 등으로 제거하지 말 것.)

---

## 3.5 Cloudflare R2 및 CDN 캐시 가이드 (`img.pickty.app`)

R2 커스텀 도메인은 보통 **Cloudflare DNS·프록시(주황 구름)** 앞에 둔다. **트래픽 비용·체감 속도**를 위해 대시보드에서 아래를 점검한다. (메뉴 이름은 플랜·UI 버전에 따라 `Caching` / `Cache` / `Rules` 로 다를 수 있음.)

| 목적 | 권장 행동 |
|------|-----------|
| **엣지 캐시** | **Cache Rules**(또는 구 **Page Rules**): 호스트 `img.pickty.app`·경로 `*` 에 대해 **Cache eligibility** 을 켜고, 가능하면 **Edge TTL** 을 **원본 `Cache-Control` 존중** 또는 **1년에 가깝게** 설정. R2가 보내는 응답에 `Cache-Control` 이 짧거나 없으면, 규칙으로 **캐시 everything** + TTL 연장을 검토(정적 객체·UUID 파일명 전제). |
| **브라우저 캐시** | 동일 호스트에 대해 **Browser Cache TTL** 을 **원본 헤더 존중**으로 두거나, 객체가 불변이면 **긴 TTL** 허용. (백엔드 `images/file` 프록시는 이미 `immutable` 응답.) |
| **R2 객체 메타데이터 (선택·권장)** | `PutObject` 시 **`Cache-Control: public, max-age=31536000, immutable`** 를 객체 메타에 넣으면, **`img.pickty.app` 직링크** 요청도 엣지·브라우저가 장기 캐시하기 쉽다. (현재 레포는 업로드 시 이 메타 자동 세팅이 **필수는 아님** — API 경유 URL만으로도 OG 등은 캐시됨.) |
| **API 도메인** | `api.pickty.app` 은 Lightsail nginx 등 **Cloudflare 밖**일 수 있음. 이미지 프록시는 **백엔드가 위 Cache-Control** 을 내려주므로, 중간 프록시가 헤더를 제거하지 않게 유지. |

**요약**: `img.pickty.app` 은 **정적·불변 URL**을 전제로 **엣지+브라우저 TTL을 길게** 잡고, 가능하면 **R2 객체에도 동일 Cache-Control** 을 심는 것이 R2 **Class B(읽기)** 호출 감소에 유리하다.

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
