-- 게임인생프로필(겜생프로필) — 프로필/게임카드/스탯/현실피드 4테이블
-- 신문지 격자형 단일 명함 카드 컨셉: 닉네임·한줄소개·아바타는 스펙아웃(중복 표시명 배제),
-- 카드에 is_main(대표 게임) 추가로 레이아웃 대형 강조 대상 결정.
-- 비회원 선점: custom_slug(주소 ID) UNIQUE + guest_password_hash(암구호) + guest_ip_hash(어뷰징 추적)

-- 1. 게임인생프로필 메타 테이블 (닉네임·한줄소개·아바타 스펙아웃 — 식별값/보안해시만)
CREATE TABLE gamer_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL, -- 회원인 경우 매핑 (비회원은 NULL)
    custom_slug VARCHAR(50) NOT NULL UNIQUE, -- URL 주소로 사용될 고유 슬러그 (중복 생성 방지)
    guest_password_hash VARCHAR(64) NULL, -- 비회원 수정 비밀번호(BCrypt, 비회원만)
    guest_ip_hash VARCHAR(64) NULL, -- 비회원 식별용 IP SHA256 해시
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gamer_profiles_user_id ON gamer_profiles(user_id);
CREATE INDEX idx_gamer_profiles_custom_slug ON gamer_profiles(custom_slug);

-- 2. 개별 게임 카드 테이블 (is_main = 신문 격자 대형 강조 대상)
CREATE TABLE gamer_profile_cards (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT NOT NULL REFERENCES gamer_profiles(id) ON DELETE CASCADE,
    game_slug VARCHAR(100) NOT NULL, -- 다국어/속어 표준화 식별을 위한 표준 영문 슬러그 (예: league-of-legends)
    game_source VARCHAR(20) NOT NULL, -- 'API', 'SEARCH', 'AI', 'DIRECT'
    game_title VARCHAR(100) NOT NULL, -- 게임명 (예: League of Legends, Hollow Knight)
    game_icon_url VARCHAR(255) NULL, -- 게임 아이콘 로고 URL
    external_api_identifier VARCHAR(100) NULL, -- API 조회용 식별값 (예: abc#kr1)
    is_main BOOLEAN NOT NULL DEFAULT FALSE, -- 대표 게임 여부 (레이아웃 대형 하이라이팅 제어)
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

-- 4. 하단 자유 갤러리 피드 테이블 (명함 캡처 영역 바깥)
CREATE TABLE gamer_profile_feeds (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT NOT NULL REFERENCES gamer_profiles(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL, -- R2 업로드 이미지
    description VARCHAR(255) NULL, -- 사진 캡션
    feed_type VARCHAR(20) NOT NULL DEFAULT 'REALITY', -- 'REALITY'(현실 피드) | 'PROOF'(자율 인증 갤러리)
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gamer_profile_feeds_profile_id ON gamer_profile_feeds(profile_id);
