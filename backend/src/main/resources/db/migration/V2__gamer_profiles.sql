-- 게임인생프로필(겜생프로필) 테이블 정의
-- 1. gamer_profiles
CREATE TABLE gamer_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL,
    custom_slug VARCHAR(50) NOT NULL UNIQUE,
    guest_password_hash VARCHAR(64) NULL,
    guest_ip_hash VARCHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_gamer_profiles_user_id ON gamer_profiles(user_id);
CREATE INDEX idx_gamer_profiles_custom_slug ON gamer_profiles(custom_slug);

-- 2. gamer_profile_cards (proof_image_url 제거)
CREATE TABLE gamer_profile_cards (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT NOT NULL REFERENCES gamer_profiles(id) ON DELETE CASCADE,
    game_slug VARCHAR(100) NOT NULL,
    game_source VARCHAR(20) NOT NULL,
    game_title VARCHAR(100) NOT NULL,
    game_icon_url VARCHAR(255) NULL,
    external_api_identifier VARCHAR(100) NULL,
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_gamer_profile_cards_profile_id ON gamer_profile_cards(profile_id);
CREATE INDEX idx_gamer_profile_cards_game_slug ON gamer_profile_cards(game_slug);

-- 3. gamer_profile_card_stats
CREATE TABLE gamer_profile_card_stats (
    id BIGSERIAL PRIMARY KEY,
    card_id BIGINT NOT NULL REFERENCES gamer_profile_cards(id) ON DELETE CASCADE,
    stat_key VARCHAR(100) NOT NULL,
    stat_value VARCHAR(100) NOT NULL,
    display_order INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_gamer_profile_card_stats_card_id ON gamer_profile_card_stats(card_id);

-- 4. gamer_profile_feeds (feed_type 추가)
CREATE TABLE gamer_profile_feeds (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT NOT NULL REFERENCES gamer_profiles(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL,
    description VARCHAR(255) NULL,
    feed_type VARCHAR(20) NOT NULL DEFAULT 'REALITY',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_gamer_profile_feeds_profile_id ON gamer_profile_feeds(profile_id);
