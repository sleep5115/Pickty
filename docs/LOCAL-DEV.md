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

| PC | `Pickty_Workspace` 절대 경로 |
|----|------------------------------|
| 집(현재) | `C:\Users\Admin\CursorProjects\Pickty_Workspace` |
| 회사 | `C:\Users\Administrator\CursorProjects\Pickty_Workspace` |

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

Pickty는 **JDK 25 (Corretto)** 가 필요하다. **회사 PC**에서는 다른 업무용 프로젝트가 **JDK 16** 등으로 돌아가는 경우가 많으므로, **Windows 사용자·시스템 환경 변수의 `JAVA_HOME`은 건드리지 않는다.** Pickty 백엔드를 띄울 **그 Cursor 터미널 / PowerShell 세션에서만** `JAVA_HOME`과 `Path`를 덮어쓴 뒤 `gradlew`를 실행한다.

JDK는 IntelliJ **Project Structure → SDK / Download JDK** 로 받으면 사용자 프로필 아래 **`.jdks`** 에 설치된다(`.jdk` 아님). **실제 `JAVA_HOME`으로 쓸 경로는 `.jdks` 바로 아래가 아니라, 그 안의 `corretto-25.x.x` 같은 버전 폴더**다.

| PC | `.jdks` 위치(기준) | 세션용 `JAVA_HOME` 예시 |
|----|-------------------|-------------------------|
| 집 | `C:\Users\Admin\.jdks` | `C:\Users\Admin\.jdks\corretto-25.0.2` |
| 회사 | `C:\Users\Administrator\.jdks` | `C:\Users\Administrator\.jdks\corretto-25.0.2` |

마지막 경로의 **Corretto 폴더명**은 설치 버전에 따라 `corretto-25.0.3` 등으로 다를 수 있음 → 탐색기나 `Get-ChildItem $env:USERPROFILE\.jdks` 로 확인.

```powershell
# 예: 회사 PC — 위 표의 본인 `JAVA_HOME` 예시로 바꿔서 사용
$env:JAVA_HOME = "C:\Users\Administrator\.jdks\corretto-25.0.2"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
$env:SPRING_PROFILES_ACTIVE = "dev"
cd backend
.\gradlew.bat bootRun
```

private **`pickty-config` README** (`PC마다 다른 것`)에도 집·회사 사용자 폴더·클론 경로 메모가 있다.

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
