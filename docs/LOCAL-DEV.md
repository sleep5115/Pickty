# 로컬 개발 메모 (Windows)

## 로컬 폴더 구조 (`Pickty_Workspace`)

**껍데기** `Pickty_Workspace` 는 `.git` 없음. 그 **안**에 본체 레포와 설정 레포만 둔다.

```text
Pickty_Workspace/
  Pickty/              ← GitHub Pickty 클론 (.git) — Cursor·IntelliJ는 보통 이 폴더를 연다
    frontend/
    backend/
    …
  pickty-config/       ← private 설정 레포 (.git), Pickty 루트 `.gitignore` 대상 아님(형제)
```

`Pickty_Workspace` 의 절대 경로는 Windows 사용자 프로필에 따라 다름 (예: `%USERPROFILE%\CursorProjects\Pickty_Workspace`).

`Pickty` 루트에서 설정을 복사할 때 상대 경로 예: `..\pickty-config\application-secrets.yaml` → `backend\src\main\resources\` (및 룰의 나머지 복사 항목).

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

Pickty는 **JDK 25 (Corretto)** 가 필요하다. PC 전체의 `JAVA_HOME`을 바꾸기 어렵다면(다른 프로젝트가 구 JDK를 쓰는 경우 등), **Pickty 백엔드를 띄울 Cursor 터미널 / PowerShell 세션에서만** `JAVA_HOME`과 `Path`를 덮어쓴 뒤 `gradlew`를 실행한다.

JDK는 IntelliJ **Project Structure → SDK / Download JDK** 로 받으면 사용자 프로필 아래 **`.jdks`** 에 설치된다(`.jdk` 아님). **실제 `JAVA_HOME`으로 쓸 경로는 `.jdks` 바로 아래가 아니라, 그 안의 `corretto-25.x.x` 같은 버전 폴더**다.

- **`.jdks` 기준**: `%USERPROFILE%\.jdks`
- **`JAVA_HOME` 예시**: `%USERPROFILE%\.jdks\corretto-25.0.2` (설치 버전에 따라 `corretto-25.0.3` 등으로 다름 → 탐색기나 `Get-ChildItem $env:USERPROFILE\.jdks` 로 확인)

```powershell
$env:JAVA_HOME = "<위에서 확인한 corretto-25.x.x 전체 경로>"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
$env:SPRING_PROFILES_ACTIVE = "dev"
cd backend
.\gradlew.bat bootRun
```

PC별 경로·복사 체크리스트는 private **`pickty-config`** 쪽 로컬 메모만 쓴다(퍼블릭 레포에는 실사용 경로를 남기지 않음).

- **(선택) Gradle만 JDK 고정:** IntelliJ 대신 터미널에서만 `gradlew` 쓰고 `JAVA_HOME` 을 안 잡을 때 — `backend/gradle.properties.example` 을 `backend/gradle.properties` 로 복사한 뒤 주석 안내에 따라 `org.gradle.java.home` 한 줄 활성화.

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
