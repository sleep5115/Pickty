-- 템플릿 초기 보드·라벨 커스텀(JSON). NULL = 기존과 동일(프론트 기본 S~E·테마 배경).
-- 적용: pickty / pickty_dev / pickty_prod 등 대상 DB에서 각각 실행.

ALTER TABLE tier_templates
    ADD COLUMN IF NOT EXISTS board_config jsonb NULL;

COMMENT ON COLUMN tier_templates.board_config IS '템플릿 도화지: schemaVersion, board(backgroundColor|backgroundUrl), rows[{id,label,color,backgroundUrl?}]';
