# 로컬 개발 메모 (Windows)

## 프론트엔드 (Next.js)

- 디렉터리: `frontend/`
- 포트: **3002** (`package.json`의 `dev` 스크립트)
- 실행:

```powershell
cd frontend
npm run dev
```

- **포트 충돌 (`EADDRINUSE 3002`)**: 이미 떠 있는 Next 프로세스 종료 후 재실행.

## 백엔드 (Spring Boot, 프로필 `dev`)

회사 PC 등에서 시스템 **JAVA_HOME**이 JDK 16 등으로 잡혀 있을 수 있음. Pickty는 **JDK 25 (Corretto)** 가 필요하므로, **Cursor / PowerShell 세션에서만** 아래처럼 덮어쓴 뒤 실행한다.

- JDK 경로( IntelliJ / Toolbox 기준 ): `C:\Users\Administrator\.jdks\corretto-25.0.2`  
  (폴더명은 **`.jdks`**, `.jdk` 아님.)

```powershell
$env:JAVA_HOME = "C:\Users\Administrator\.jdks\corretto-25.0.2"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
$env:SPRING_PROFILES_ACTIVE = "dev"
cd backend
.\gradlew.bat bootRun
```

- **포트 충돌 (`Port 8080 was already in use`)**: IntelliJ 등에서 이미 백엔드를 띄운 경우. 한쪽만 종료하거나 포트 분리.

## R2 이미지(`img.pickty.app`)가 403·엑박일 때

브라우저가 **`crossOrigin="anonymous"`** 로 요청하거나(티어 카드에 예전에 적용됨), **직접** `img.pickty.app`에 요청할 때 Cloudflare/R2가 막으면 **403** + 엑박이 납니다.

1. **버킷·커스텀 도메인**: 객체 **공개 읽기**가 가능한지(퍼블릭 URL 정책) 확인.
2. **R2 CORS**(Cloudflare 대시보드 → R2 → 버킷 → CORS)에 예시처럼 로컬·운영 오리진을 넣습니다.

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3002",
      "http://127.0.0.1:3002",
      "https://pickty.app",
      "https://www.pickty.app"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

3. **이미지 표시 경로:** DB에는 `https://img.pickty.app/{uuid}.png` 가 저장되지만, 화면에서는 **`picktyImageDisplaySrc`** 가 이를 **`{NEXT_PUBLIC_API_URL}/api/v1/images/file/{key}`** 로 바꿉니다. 백엔드가 R2(S3 API)로 **GetObject** 해서 내려주므로, **`img.pickty.app` 공개 읽기가 403이어도** 로컬·운영 모두 API만 살아 있으면 타일·썸네일이 뜹니다.  
   템플릿 썸네일 `next/image`는 위 API URL을 `remotePatterns`로 허용(로컬은 `localhost`/`127.0.0.1:8080` + `/api/v1/images/**`).  
   **PNG 캡처(html-to-image):** 이미지 응답에 `Access-Control-Allow-Origin: *` 를 붙여 두었습니다(교차 출처 캔버스용).

## 환경 분리 요약

| 환경 | Spring 프로필 | DB |
|------|---------------|-----|
| 로컬 PC (Pickty 개발) | `dev` | Lightsail `pickty_dev` 등 (`application-secrets.yaml`) |
| 운영 (Lightsail) | `prod` | `pickty_prod` |
