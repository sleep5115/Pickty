-- community_posts 추천/비추천 카운트 컬럼 추가
ALTER TABLE community_posts
    ADD COLUMN IF NOT EXISTS up_count   bigint NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS down_count bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN community_posts.up_count   IS '역정규화: COMMUNITY_POST 대상 UPVOTE 반응 수';
COMMENT ON COLUMN community_posts.down_count IS '역정규화: COMMUNITY_POST 대상 DOWNVOTE 반응 수';
