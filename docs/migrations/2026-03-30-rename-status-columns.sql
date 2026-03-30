-- tier_templates.status -> template_status (users.account_status 와 동일한 `{도메인}_status` 네이밍)
-- tier_results: 아래 DO 블록은 **기존 컬럼명이 `status`일 때만** `result_status`로 RENAME 한다.
--   원래 `tier_results` 에 `status` 가 없었다면(대부분 JPA 최초 생성 테이블) 여기서는 아무 컬럼도 생기지 않는다.
--   그 경우 반드시 **`2026-03-30-tier-results-result-status-soft-delete.sql`** 를 같은 DB에 실행해 `result_status` 를 ADD 한다.
--
-- 선행: `2026-03-29-tier-templates-status-default.sql` 등으로 tier_templates.status 가 이미 있어야 함.
-- pickty_dev / pickty_prod 등 사용 중인 DB마다 한 번씩 실행 (백업 권장).

ALTER TABLE tier_templates
    RENAME COLUMN status TO template_status;

COMMENT ON COLUMN tier_templates.template_status IS 'ACTIVE | DELETED (소프트 삭제)';

-- tier_results 에 status 컬럼이 있는 환경만 이름 변경 (없으면 스킵)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tier_results'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE tier_results RENAME COLUMN status TO result_status;
    END IF;
END $$;
