-- tier_templates.status (ACTIVE | DELETED) — 기존 행·신규 INSERT 모두 안전하게
-- (ddl-auto만 쓰면 NOT NULL 컬럼 추가 시 기본값 없이 실패할 수 있음)

ALTER TABLE tier_templates
    ADD COLUMN IF NOT EXISTS status varchar(20);

UPDATE tier_templates
SET status = 'ACTIVE'
WHERE status IS NULL;

ALTER TABLE tier_templates
    ALTER COLUMN status SET DEFAULT 'ACTIVE';

ALTER TABLE tier_templates
    ALTER COLUMN status SET NOT NULL;
