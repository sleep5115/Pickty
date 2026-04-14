-- P2 커뮤니티: 다형성 통합 reactions / comments + 티어 템플릿·결과 카운트 역정규화
-- pickty_dev / pickty_prod / pickty 등 사용 DB마다 한 번씩 실행 (백업 권장).
--
-- user FK 는 기존 users.id 가 BIGINT 이므로 reactions.comments 의 user_id 도 BIGINT 로 통일
-- (기획 문서의 UUID 표기와 달리 현행 스키마에 맞춤).

-- ---------------------------------------------------------------------------
-- 1) reactions — 회원(user_id) 또는 비회원(guest_ip_hash) 중 하나로 1행
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type varchar(32) NOT NULL,
    target_id uuid NOT NULL,
    user_id bigint NULL REFERENCES users (id) ON DELETE CASCADE,
    guest_ip_hash varchar(64) NULL,
    reaction_type varchar(16) NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT ck_reactions_type CHECK (reaction_type IN ('LIKE', 'UPVOTE', 'DOWNVOTE')),
    CONSTRAINT ck_reactions_actor CHECK (
        (user_id IS NOT NULL AND guest_ip_hash IS NULL)
        OR (user_id IS NULL AND guest_ip_hash IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS ix_reactions_target ON reactions (target_type, target_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_reactions_target_member ON reactions (target_type, target_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_reactions_target_guest_ip ON reactions (target_type, target_id, guest_ip_hash) WHERE guest_ip_hash IS NOT NULL;

COMMENT ON TABLE reactions IS '다형성 반응: TIER_TEMPLATE(LIKE), TIER_RESULT(UP/DOWN) 등';
COMMENT ON COLUMN reactions.target_type IS 'TIER_TEMPLATE | TIER_RESULT | WORLDCUP_TEMPLATE | WORLDCUP_RESULT | community_post 등';
COMMENT ON COLUMN reactions.target_id IS '대상 엔티티 PK (FK 제약 없음 — 앱에서 존재·권한 검증)';
COMMENT ON COLUMN reactions.guest_ip_hash IS '비회원 반응 식별용 전체 IP 의 SHA-256 hex';

-- ---------------------------------------------------------------------------
-- 2) comments — 다형성 댓글, 1-depth 대댓글(parent_comment_id), 비회원 필드
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type varchar(32) NOT NULL,
    target_id uuid NOT NULL,
    user_id bigint NULL REFERENCES users (id) ON DELETE SET NULL,
    parent_comment_id uuid NULL REFERENCES comments (id) ON DELETE SET NULL,
    body text NOT NULL,
    comment_status varchar(16) NOT NULL DEFAULT 'ACTIVE',
    author_name varchar(64) NULL,
    author_ip_prefix varchar(16) NULL,
    guest_password varchar(255) NULL,
    guest_ip_hash varchar(64) NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT ck_comments_status CHECK (comment_status IN ('ACTIVE', 'DELETED')),
    CONSTRAINT ck_comments_guest_vs_member CHECK (
        (
            user_id IS NOT NULL
            AND author_name IS NULL
            AND guest_password IS NULL
            AND guest_ip_hash IS NULL
            AND author_ip_prefix IS NULL
        )
        OR (
            user_id IS NULL
            AND author_name IS NOT NULL
            AND guest_password IS NOT NULL
            AND guest_ip_hash IS NOT NULL
        )
    )
);

CREATE INDEX IF NOT EXISTS ix_comments_target ON comments (target_type, target_id);
CREATE INDEX IF NOT EXISTS ix_comments_parent ON comments (parent_comment_id);

COMMENT ON TABLE comments IS '다형성 댓글; 비회원은 author_name + guest_password(해시) + guest_ip_hash 필수';
COMMENT ON COLUMN comments.author_ip_prefix IS '비회원 표시용 IP 앞 두 옥텟/세그먼트 (예 118.235)';
COMMENT ON COLUMN comments.guest_password IS '비회원 수정/삭제용 비밀번호 해시(BCrypt 등)';
COMMENT ON COLUMN comments.guest_ip_hash IS '어뷰징 완화용 IP 해시(원문 IP 비저장)';

-- ---------------------------------------------------------------------------
-- 3) tier_templates — 좋아요·댓글 수 (역정규화)
-- ---------------------------------------------------------------------------
ALTER TABLE tier_templates ADD COLUMN IF NOT EXISTS like_count bigint NOT NULL DEFAULT 0;
ALTER TABLE tier_templates ADD COLUMN IF NOT EXISTS comment_count bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN tier_templates.like_count IS '역정규화: TIER_TEMPLATE 대상 LIKE 반응 수(앱에서 동기화)';
COMMENT ON COLUMN tier_templates.comment_count IS '역정규화: TIER_TEMPLATE 대상 댓글 수(앱에서 동기화)';

-- ---------------------------------------------------------------------------
-- 4) tier_results — 추천/비추천·댓글 수 (역정규화)
-- ---------------------------------------------------------------------------
ALTER TABLE tier_results ADD COLUMN IF NOT EXISTS up_count bigint NOT NULL DEFAULT 0;
ALTER TABLE tier_results ADD COLUMN IF NOT EXISTS down_count bigint NOT NULL DEFAULT 0;
ALTER TABLE tier_results ADD COLUMN IF NOT EXISTS comment_count bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN tier_results.up_count IS '역정규화: TIER_RESULT 대상 UPVOTE 수';
COMMENT ON COLUMN tier_results.down_count IS '역정규화: TIER_RESULT 대상 DOWNVOTE 수';
COMMENT ON COLUMN tier_results.comment_count IS '역정규화: TIER_RESULT 대상 댓글 수';

-- ---------------------------------------------------------------------------
-- 5) 기존 DB 정합 (이전 스크립트만 적용된 환경)
-- ---------------------------------------------------------------------------
ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_ip_prefix varchar(16) NULL;
COMMENT ON COLUMN comments.author_ip_prefix IS '비회원 표시용 IP 앞 두 옥텟/세그먼트 (예 118.235)';

ALTER TABLE reactions DROP CONSTRAINT IF EXISTS uk_reactions_target_user;
ALTER TABLE reactions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE reactions ADD COLUMN IF NOT EXISTS guest_ip_hash varchar(64) NULL;

ALTER TABLE reactions DROP CONSTRAINT IF EXISTS ck_reactions_actor;
ALTER TABLE reactions ADD CONSTRAINT ck_reactions_actor CHECK (
    (user_id IS NOT NULL AND guest_ip_hash IS NULL)
    OR (user_id IS NULL AND guest_ip_hash IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_reactions_target_member ON reactions (target_type, target_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_reactions_target_guest_ip ON reactions (target_type, target_id, guest_ip_hash) WHERE guest_ip_hash IS NOT NULL;

-- 이전 CHECK 에 author_ip_prefix 가 없으면 교체
ALTER TABLE comments DROP CONSTRAINT IF EXISTS ck_comments_guest_vs_member;
ALTER TABLE comments ADD CONSTRAINT ck_comments_guest_vs_member CHECK (
    (
        user_id IS NOT NULL
        AND author_name IS NULL
        AND guest_password IS NULL
        AND guest_ip_hash IS NULL
        AND author_ip_prefix IS NULL
    )
    OR (
        user_id IS NULL
        AND author_name IS NOT NULL
        AND guest_password IS NOT NULL
        AND guest_ip_hash IS NOT NULL
    )
);
