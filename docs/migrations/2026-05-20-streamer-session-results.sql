-- 스트리머 세션 결과 영속화 — 방장 명시 종료 또는 Idle Sweeper 강제 만료 시 Valkey 집계를 PostgreSQL로 이관.
-- summary 컬럼은 매치별 득표 / 퀵투표 결과 / 티어 통계(추후 Phase 2)를 묶은 JSON.
CREATE TABLE IF NOT EXISTS streamer_session_results (
    id              bigserial   PRIMARY KEY,
    session_id      uuid        NOT NULL UNIQUE,
    template_type   varchar(16) NOT NULL,
    template_id     uuid        NOT NULL,
    host_user_id    bigint,
    finish_reason   varchar(24) NOT NULL,
    summary         jsonb       NOT NULL,
    started_at      timestamp   NOT NULL,
    finished_at     timestamp   NOT NULL DEFAULT now(),
    created_at      timestamp   NOT NULL DEFAULT now()
);

COMMENT ON TABLE streamer_session_results IS '스트리머-시청자 실시간 세션 종료 후 영속화된 집계 결과';
COMMENT ON COLUMN streamer_session_results.template_type IS 'TIER | WORLDCUP';
COMMENT ON COLUMN streamer_session_results.finish_reason IS 'HOST_FINISHED | SWEEPER_EXPIRED';
COMMENT ON COLUMN streamer_session_results.summary IS '매치별 득표, 퀵투표 결과, 티어 통계 등 통합 JSON';

CREATE INDEX IF NOT EXISTS idx_streamer_session_results_template_finished
    ON streamer_session_results (template_id, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_streamer_session_results_host_finished
    ON streamer_session_results (host_user_id, finished_at DESC)
    WHERE host_user_id IS NOT NULL;
