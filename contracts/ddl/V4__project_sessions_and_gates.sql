-- 项目连续会话与人工 Gate 的权威持久化。
-- Factory Session 是跨多个 Run 的操作员上下文，不等同于一次 OpenCode host_session。

CREATE TABLE factory_session (
    session_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES project(project_id),
    parent_session_id TEXT REFERENCES factory_session(session_id),
    agent TEXT NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('ACTIVE','WAITING','COMPLETED','BLOCKED')),
    current BOOLEAN NOT NULL DEFAULT FALSE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_factory_session_current
    ON factory_session(project_id) WHERE current AND NOT archived;

CREATE TABLE session_message (
    message_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES factory_session(session_id),
    run_id TEXT REFERENCES run(run_id),
    role TEXT NOT NULL CHECK (role IN ('OPERATOR','AGENT','SYSTEM')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE session_run (
    session_id TEXT NOT NULL REFERENCES factory_session(session_id),
    run_id TEXT NOT NULL UNIQUE REFERENCES run(run_id),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, run_id)
);

CREATE TABLE stage_gate (
    gate_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES project(project_id),
    session_id TEXT NOT NULL REFERENCES factory_session(session_id),
    run_id TEXT NOT NULL REFERENCES run(run_id),
    gate_type TEXT NOT NULL CHECK (gate_type IN ('REQUIREMENT','DESIGN','CODING','TESTING','SYSTEM_ACCEPTANCE')),
    expected_version INTEGER NOT NULL DEFAULT 0 CHECK (expected_version >= 0),
    status TEXT NOT NULL CHECK (status IN ('WAITING','APPROVED','CHANGES_REQUESTED')),
    candidate_ref TEXT NOT NULL,
    handoff_id TEXT REFERENCES handoff(handoff_id),
    review_record_id TEXT REFERENCES review_record(review_id),
    baseline_id TEXT REFERENCES baseline(baseline_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ
);
