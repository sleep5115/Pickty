-- 계정 병합 흡수측 추적 + 이메일 재사용(좀비 MERGED) 방지
-- 적용 후: ddl-auto 와 무관하게 운영 DB 에서 한 번 실행 권장

ALTER TABLE users ADD COLUMN IF NOT EXISTS merged_into_user_id BIGINT NULL;

CREATE INDEX IF NOT EXISTS idx_users_merged_into_user_id ON users (merged_into_user_id);

COMMENT ON COLUMN users.merged_into_user_id IS '병합 시 생존 계정(users.id). 흡수 계정만 값 있음.';

-- 선택: 컬럼 추가 이전에 쌓인 MERGED 행에 이메일이 남아 OAuth 재가입이 막히는 경우(merged_into 미기록)
-- UPDATE users SET email = NULL, user_name = NULL, profile_image_url = NULL WHERE account_status = 'MERGED';
