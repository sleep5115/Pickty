-- 게시글(community_posts) 댓글 수 역정규화 — comments.target_type = 'community_post' 와 동기화
-- pickty_dev / pickty_prod / 로컬 DB 등 각 환경에서 한 번 실행 (백업 권장).

ALTER TABLE community_posts
    ADD COLUMN IF NOT EXISTS comment_count bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN community_posts.comment_count IS '역정규화: community_post 대상 활성 댓글 수(앱에서 동기화)';

COMMENT ON COLUMN comments.target_type IS 'TIER_TEMPLATE | TIER_RESULT | WORLDCUP_TEMPLATE | WORLDCUP_RESULT | community_post 등 (varchar, 앱 enum 과 동일 문자열)';
