-- tier_results.result_status — ACTIVE | DELETED (소프트 삭제)
-- 삭제 시 API 는 행을 지우지 않고 DELETED + is_public = false 로 맞춤(앱 로직).
--
-- **이 파일이 result_status 컬럼을 실제로 만든다.** `ADD COLUMN IF NOT EXISTS` 이므로
--   `rename-status-columns.sql` 로 RENAME 된 DB 와, 처음부터 `status` 가 없던 DB 모두 안전.
-- pickty_dev / pickty_prod 등 사용 DB마다 한 번씩 실행 (백업 권장).

ALTER TABLE tier_results ADD COLUMN IF NOT EXISTS result_status varchar(20);

UPDATE tier_results
SET result_status = 'ACTIVE'
WHERE result_status IS NULL OR trim(result_status) = '';

ALTER TABLE tier_results
    ALTER COLUMN result_status SET DEFAULT 'ACTIVE';

ALTER TABLE tier_results
    ALTER COLUMN result_status SET NOT NULL;

COMMENT ON COLUMN tier_results.result_status IS 'ACTIVE | DELETED (소프트 삭제)';
