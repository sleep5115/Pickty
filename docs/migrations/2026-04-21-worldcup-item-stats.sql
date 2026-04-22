-- 이상형 월드컵 템플릿별 아이템 통계 (누적)
CREATE TABLE IF NOT EXISTS worldcup_item_stats (
    id bigserial PRIMARY KEY,
    template_id uuid NOT NULL REFERENCES worldcup_templates (id) ON DELETE CASCADE,
    item_id varchar(512) NOT NULL,
    final_win_count bigint NOT NULL DEFAULT 0,
    match_count bigint NOT NULL DEFAULT 0,
    win_count bigint NOT NULL DEFAULT 0,
    rerolled_count bigint NOT NULL DEFAULT 0,
    dropped_count bigint NOT NULL DEFAULT 0,
    kept_both_count bigint NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT uq_worldcup_item_stats_tpl_item UNIQUE (template_id, item_id)
);

COMMENT ON TABLE worldcup_item_stats IS '월드컵 템플릿·아이템별 플레이 통계 누적';
COMMENT ON COLUMN worldcup_item_stats.item_id IS '템플릿 items(JSON) 내 아이템 고유 id';
COMMENT ON COLUMN worldcup_item_stats.final_win_count IS '해당 템플릿에서 최종 우승(한 판 완료) 횟수';

CREATE INDEX IF NOT EXISTS idx_worldcup_item_stats_template
    ON worldcup_item_stats (template_id);
