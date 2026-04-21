-- 월드컵 플레이 한 판(세션) 결과 · 선택 이력 저장
CREATE TABLE IF NOT EXISTS worldcup_play_results (
    id bigserial PRIMARY KEY,
    template_id uuid NOT NULL REFERENCES worldcup_templates (id) ON DELETE CASCADE,
    winner_item_id varchar(512) NOT NULL,
    match_history jsonb NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
);

COMMENT ON TABLE worldcup_play_results IS '월드컵 플레이 완료 한 판당 우승자·대진 이력(JSON)';
COMMENT ON COLUMN worldcup_play_results.match_history IS '클라이언트 WorldCupMatchHistory 배열(JSON)';

CREATE INDEX IF NOT EXISTS idx_worldcup_play_results_template_created
    ON worldcup_play_results (template_id, created_at DESC);
