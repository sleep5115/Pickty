# 게임인생프로필(겜생프로필) 서비스 기술 구현 설계서

본 설계서는 Pickty 서비스 내에 신규 콘텐츠 영역인 **게임인생프로필 (약칭: 겜생프로필, GNB 메뉴명: 프로필)**을 구축하기 위한 구체적인 기술 설계 및 구현 절차를 기술합니다.

---

## 1. 개요 및 인증/권한 설계

* **비회원 주소 ID(슬러그) & 비밀번호 선점**:
  - 가입 과정을 거치지 않더라도 최초 생성 단계에서 사용자가 직접 **[원하는 주소 ID(예: sleep5165)]**와 **[암구호(비밀번호)]**를 입력하여 프로필을 생성합니다.
  - 생성된 주소 ID는 즉시 `custom_slug`에 바인딩되어 고유 URL인 `pickty.app/profile/sleep5165`로 매핑됩니다.
  - **초간단 2-필드 가입/생성**: 가입 및 디자인 허들을 완전히 없애기 위해 아바타 변경, 표시 닉네임, 한줄소개 입력란은 생략하고 오직 **원하는 주소 ID**와 **암구호(비밀번호)**만 입력받습니다.
* **비회원 권한 검증 (암구호 기반)**:
  - 비회원 프로필의 수정용 비밀번호는 생성 시 단방향 해싱(`guest_password_hash`)하여 저장됩니다.
  - 편집 요청 시 `POST /api/v1/profile/{slug}/verify-password` API를 통해 암구호를 검증하고, 검증 성공 시 Valkey에 1시간 만료인 임시 수정 토큰(`gamer:profile:edit-token:{slug}`)을 발행하여 응답으로 반환합니다.
  - 프론트엔드는 이 토큰을 `sessionStorage`에 보관하고, 이후 프로필 수정/삭제/인증샷 업로드 API 호출 시 `X-Profile-Edit-Token` 헤더로 첨부하여 권한을 증명합니다.
* **비회원 전용 이미지 업로드 및 보안 제한**:
  - 프로필 이미지 및 스크린샷 전용 업로드 API(`POST /api/v1/profile/image-upload`)를 신설하여 Spring Security에서 `permitAll()`로 허용하고, Valkey를 사용하여 **단일 IP 기준 시간당 최대 10회**로 업로드 횟수를 제한합니다.
* **회원 권한**: 소셜 로그인 유저는 본인의 `user_id`와 프로필의 `user_id` 일치 여부로 수정 권한을 판별합니다.
* **자율 인증제**: 각 게임 카드별이 아닌, 프로필 하단의 [자율 인증 갤러리] 영역에 사용자가 자유롭게 여러 장의 인증 스크린샷을 업로드합니다. 업로드된 사진 목록 중 feed_type이 'PROOF'인 이미지가 1개 이상 존재하면 "인증내역이 있는 프로필"로 판별하여 프로필 카드 하단에 [인증있음] 표시와 프로필 주소(`pickty.app/profile/{slug}`)를 노출합니다.

---

## 2. DB 마이그레이션 설계

### [NEW] `docs/migrations/2026-06-09-gamer-profiles.sql`
```sql
-- 1. 게임인생프로필 메타 테이블 (닉네임, 한줄소개, 아바타 스펙아웃 반영)
CREATE TABLE gamer_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL, -- 회원인 경우 매핑 (비회원은 NULL)
    custom_slug VARCHAR(50) NOT NULL UNIQUE, -- URL 주소로 사용될 고유 슬러그 (중복 생성 방지)
    guest_password_hash VARCHAR(64) NULL, -- 비회원 수정 비밀번호
    guest_ip_hash VARCHAR(64) NULL, -- 비회원 식별용 IP SHA256 해시
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gamer_profiles_user_id ON gamer_profiles(user_id);
CREATE INDEX idx_gamer_profiles_custom_slug ON gamer_profiles(custom_slug);

-- 2. 개별 게임 카드 테이블 (is_main 컬럼 추가 반영)
CREATE TABLE gamer_profile_cards (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT NOT NULL REFERENCES gamer_profiles(id) ON DELETE CASCADE,
    game_slug VARCHAR(100) NOT NULL, -- 다국어/속어 표준화 식별을 위한 표준 영문 슬러그 (예: league-of-legends)
    game_source VARCHAR(20) NOT NULL, -- 'API', 'SEARCH', 'AI', 'DIRECT'
    game_title VARCHAR(100) NOT NULL, -- 게임명 (예: League of Legends, Hollow Knight)
    game_icon_url VARCHAR(255) NULL, -- 게임 아이콘 로고 URL
    external_api_identifier VARCHAR(100) NULL, -- API 조회용 식별값
    is_main BOOLEAN NOT NULL DEFAULT FALSE, -- 레이아웃 대형 하이라이팅 제어
    display_order INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gamer_profile_cards_profile_id ON gamer_profile_cards(profile_id);
CREATE INDEX idx_gamer_profile_cards_game_slug ON gamer_profile_cards(game_slug);

-- 3. 카드 하위 Key-Value 스탯 테이블
CREATE TABLE gamer_profile_card_stats (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES gamer_profile_cards(id) ON DELETE CASCADE,
    stat_key VARCHAR(100) NOT NULL, -- 스탯 이름 (예: 최고 티어, 업적)
    stat_value VARCHAR(100) NOT NULL, -- 스탯 값 (예: 다이아몬드4, 5문 클리어)
    display_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_gamer_profile_card_stats_card_id ON gamer_profile_card_stats(card_id);

-- 4. 하단 자유 갤러리 피드 테이블
CREATE TABLE gamer_profile_feeds (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT NOT NULL REFERENCES gamer_profiles(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL, -- R2 업로드 이미지
    description VARCHAR(255) NULL, -- 사진 캡션
    feed_type VARCHAR(20) NOT NULL DEFAULT 'REALITY',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gamer_profile_feeds_profile_id ON gamer_profile_feeds(profile_id);
```

---

## 3. 백엔드 설계 (Kotlin Spring Boot)

### 3.1. 엔티티 및 리포지토리 구성
- `entity/GamerProfile.kt`, `entity/GamerProfileCard.kt`, `entity/GamerProfileCardStat.kt`, `entity/GamerProfileFeed.kt` 정의 (GamerProfileCard 내 `isMain: Boolean` 속성 추가 반영)

### 3.2. AI 카드 조립 및 속어 변환 서비스 (`GamerProfileAiService.kt`)
- Gemini 2.5 Flash JSON Mode 파싱 연동 및 표준 `game_slug` 변환.

### 3.3. API 비용 최적화 및 Rate Limiting (Valkey)
- AI 카드 생성 API 호출 시 Valkey 키 기반 하루 최대 5회 제한.

### 3.4. 외부 게임 API 조회 연동 (`GameStatsService.kt`)
- LoL 및 오버워치 통신 연동 및 API Key 미등록 시 Mock 데이터 제공 Fallback 기능.

### 3.5. 컨트롤러 및 보안 구성 (`GamerProfileController.kt`)
- 비회원 이미지 업로드 API(`/api/v1/profile/image-upload`) 및 생성/중복체크/암구호 검증 API의 Security `permitAll()` 적용.

---

## 4. 프론트엔드 설계 (Next.js 16)

### 4.1. GNB 네비게이션 연동
- [gnb.tsx](file:///c:/Users/Administrator/CursorProjects/Pickty_Workspace/Pickty/frontend/src/components/layout/gnb.tsx)의 `NAV_LINKS` 배열에 프로필 메뉴 추가.

### 4.2. 생성 화면 및 주소 ID/암구호 선점 UI Flow
* **프로필 생성 페이지 (`/profile/create`)**:
  - 사용자로부터 오직 **원하는 주소 ID (Slug)**, **암구호(비밀번호)** 2가지만 입력받습니다. (닉네임, 한줄소개, 아바타 변경란은 생략)
  - 프로필 생성 성공 시 해당 슬러그를 브라우저 `localStorage`의 `pickty_profile_history` 배열에 자동으로 추가합니다.
  - 생성 완료 팝업/모달: 주소 복사 버튼 노출 및 메모장 보관 유도 문구(귀찮다면 소셜 로그인 저장 연동 권장 및 링크) 노출.
* **프로필 상세 페이지 (`/profile/[slug]`)**:
  - `[편집/인증 등록]` 버튼 클릭 시 암구호 입력 모달이 팝업됩니다.
  - 암구호 검증 API 통과 후 발급된 수정 토큰을 `sessionStorage`에 보관하고, 모든 수정 및 업로드 API의 `X-Profile-Edit-Token` 헤더로 전달하여 원활한 편집 기능을 보장합니다.

### 4.3. 프로필 상세 및 검색 메인 UI 고도화 (`/profile/page.tsx`)
* **검색바 하드코딩 제거 및 로컬스토리지 기반 최근 방문/작성 기록 표시**:
  - 검색창 플레이스홀더를 `"프로필 주소 ID 입력 (예: my-nickname)"`로 교체합니다.
  - 검색창 바로 하단에 `localStorage` 키 `pickty_profile_history`에 저장된 프로필 ID 목록을 로드하여 둥근 배지 형태로 나열하고 우측에 `✕` 개별 삭제 버튼을 구현합니다.

### 4.4. 레이아웃 및 단일 명함 카드 컴포넌트 설계 (frontend/src/components/profile/)
* **상단: 신문 격자형 명함 카드 (Newspaper Grid Layout)**:
  - 다중 카드 렌더링 대신, 단 하나의 직사각형 컨테이너 `div` (캡처 대상 영역)인 `GamerProfileCard.tsx`로 통합 구현합니다.
  - 카드는 내부적으로 Tailwind CSS Grid를 채택하여 빽빽한 지면을 구성합니다:
    - 래퍼 클래스: `grid grid-cols-1 md:grid-cols-3 gap-3 p-4`
    - **대표 게임 블록 (`isMain === true`인 카드)**: 대형 하이라이팅 영역으로 `md:col-span-2 md:row-span-2`를 부여하여 왼쪽에 배치하고, API 연동 전적 정보(레벨, 티어, 모스트 챔피언 등)를 조밀하게 표출합니다.
    - **일반 게임 블록**: `col-span-1`로 우측 및 하단에 꼬깃꼬깃 맞물리도록 정렬합니다.
  - **이미지 다운로드**: 카드 영역(div) 하나만 깔끔하게 캡처하여 다운로드할 수 있도록 html2canvas/html-to-image 캡처 기능을 연결합니다.
* **하단: 피드 및 자율 인증 갤러리**:
  - 명함 카드 영역 바깥(하단)에 배치되며, 두 개의 탭으로 이원화하여 렌더링합니다:
    - **현실 피드 (Reality Feed)**: `feedType === 'REALITY'`에 매핑되는 데스크셋업, 게이밍 장비 등 현실 게이머 감성의 사진 피드.
    - **인증 갤러리 (Verification Feed)**: `feedType === 'PROOF'`에 매핑되는 자율인증 스크린샷 이미지 피드.
* **이미지 업로드 압축 통합**:
  - 사진 추가 시 WebP 형식, 최대 1024px, 0.5MB 수준으로 압축 리사이징 후 비회원 업로드 API `/api/v1/profile/image-upload`로 송출합니다.


---

## 5. 검증 계획 (Verification Plan)

### 5.1. 백엔드 테스트 코드 작성
- 주소 ID(slug) 중복 생성 테스트 추가: 이미 존재하는 슬러그로 `POST /api/v1/profile` 호출 시 `409 Conflict` 예외 발생 검증.
- 암구호 검증 테스트 추가: 잘못된 암구호 입력 시 `401 Unauthorized` 또는 `403 Forbidden` 리턴 검증.
- 비회원 전용 업로드 API `/api/v1/profile/image-upload` 호출 시 IP당 10회 제한 초과 시 `429 Too Many Requests` 검증.
