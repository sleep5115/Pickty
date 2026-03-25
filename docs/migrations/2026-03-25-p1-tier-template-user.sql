-- P1: OAuth 전용 users · 템플릿 단일 썸네일 URL
-- pickty_dev / pickty_prod 각 DB에서 한 번씩 실행 (백업 후 적용 권장)

-- 1) users.password 제거 (100% OAuth)
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- 2) tier_templates: thumbnail_urls(jsonb) + list_thumbnail_uses_custom → thumbnail_url(text)
ALTER TABLE tier_templates ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(2048);

-- 구 JSON 배열이면 첫 URL만 이전(그리드 4장은 재저장 시 합성 PNG로 교체 가능)
UPDATE tier_templates
SET thumbnail_url = thumbnail_urls->>0
WHERE thumbnail_url IS NULL
  AND thumbnail_urls IS NOT NULL
  AND jsonb_typeof(thumbnail_urls) = 'array'
  AND jsonb_array_length(thumbnail_urls) > 0;

ALTER TABLE tier_templates DROP COLUMN IF EXISTS list_thumbnail_uses_custom;
ALTER TABLE tier_templates DROP COLUMN IF EXISTS thumbnail_urls;
