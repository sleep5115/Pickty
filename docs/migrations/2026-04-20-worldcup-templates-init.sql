-- 이상형 월드컵 템플릿 (MVP 스키마)
CREATE TABLE IF NOT EXISTS worldcup_templates (
    id uuid PRIMARY KEY,
    title varchar(100) NOT NULL,
    description text,
    items jsonb NOT NULL,
    version integer NOT NULL,
    creator_id bigint,
    thumbnail_url varchar(2048),
    template_status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    layout_mode varchar(32) NOT NULL DEFAULT 'split_diagonal',
    like_count bigint NOT NULL DEFAULT 0,
    comment_count bigint NOT NULL DEFAULT 0,
    view_count bigint NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

COMMENT ON TABLE worldcup_templates IS '이상형 월드컵 템플릿 — 아이템 정의(JSONB)';
COMMENT ON COLUMN worldcup_templates.items IS '아이템 목록 등 플레이 페이로드(JSON)';
COMMENT ON COLUMN worldcup_templates.layout_mode IS '대진 UI: split_lr | split_diagonal 등';
COMMENT ON COLUMN worldcup_templates.template_status IS 'ACTIVE | DELETED (티어 템플릿과 동일 패턴)';

CREATE INDEX IF NOT EXISTS idx_worldcup_templates_status_created
    ON worldcup_templates (template_status, created_at DESC);
