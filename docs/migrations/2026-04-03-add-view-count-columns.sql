-- tier_templates / tier_results — 조회수 (역정규화 + Valkey write-back 배치와 합산 노출)
ALTER TABLE tier_templates ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0;
ALTER TABLE tier_results ADD COLUMN IF NOT EXISTS view_count bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN tier_templates.view_count IS '누적 조회수(배치로 Valkey pickty:views:templates 와 동기화)';
COMMENT ON COLUMN tier_results.view_count IS '누적 조회수(배치로 Valkey pickty:views:results 와 동기화)';
