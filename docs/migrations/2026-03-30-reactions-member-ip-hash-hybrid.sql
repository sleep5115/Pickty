-- 하이브리드 반응: 회원 row에도 guest_ip_hash 저장(동일 IP 비회원 꼼수 차단).
-- 기존 uk_reactions_target_guest_ip 는 guest_ip_hash IS NOT NULL 이면 회원 행까지 포함되어
-- NAT 내 서로 다른 회원이 같은 대상에 투표할 수 없게 막히므로, 비회원 행에만 유니크를 적용한다.

ALTER TABLE reactions DROP CONSTRAINT IF EXISTS ck_reactions_actor;
ALTER TABLE reactions ADD CONSTRAINT ck_reactions_actor CHECK (
    (user_id IS NULL AND guest_ip_hash IS NOT NULL)
    OR (user_id IS NOT NULL)
);

DROP INDEX IF EXISTS uk_reactions_target_guest_ip;
CREATE UNIQUE INDEX uk_reactions_target_guest_ip ON reactions (target_type, target_id, guest_ip_hash)
    WHERE user_id IS NULL AND guest_ip_hash IS NOT NULL;

COMMENT ON CONSTRAINT ck_reactions_actor ON reactions IS '비회원: user_id NULL + guest_ip_hash 필수. 회원: user_id 필수, guest_ip_hash 권장(레거시 NULL 허용).';
