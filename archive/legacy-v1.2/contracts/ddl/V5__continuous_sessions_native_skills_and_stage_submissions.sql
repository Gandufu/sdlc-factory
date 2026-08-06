-- 持续 OpenCode 会话、原生 Skill 与需求/设计候选提交。

ALTER TABLE factory_session
    ADD COLUMN session_type TEXT NOT NULL DEFAULT 'PROJECT_MAIN'
        CHECK (session_type IN ('PROJECT_MAIN','CODING_CHILD','TESTING_CHILD','VALIDATOR_CHILD')),
    ADD COLUMN opencode_session_id TEXT,
    ADD COLUMN todo_authority TEXT NOT NULL DEFAULT 'OPENCODE_NATIVE'
        CHECK (todo_authority = 'OPENCODE_NATIVE'),
    ADD COLUMN stage_type TEXT
        CHECK (stage_type IN ('REQUIREMENT','DESIGN','PLANNING','CODING','TESTING','SYSTEM_ACCEPTANCE')),
    ADD COLUMN cu_id TEXT REFERENCES capability_unit(cu_id);

UPDATE factory_session
SET session_type = CASE WHEN parent_session_id IS NULL THEN 'PROJECT_MAIN' ELSE 'CODING_CHILD' END;

CREATE UNIQUE INDEX uq_factory_session_opencode
    ON factory_session(opencode_session_id) WHERE opencode_session_id IS NOT NULL;

CREATE TABLE skill_definition (
    skill_id TEXT NOT NULL CHECK (skill_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    version TEXT NOT NULL CHECK (version ~ '^\d+\.\d+\.\d+$'),
    description TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    native_path TEXT NOT NULL CHECK (native_path ~ '^\.opencode/skills/[a-z0-9]+(-[a-z0-9]+)*/SKILL\.md$'),
    load_mode TEXT NOT NULL CHECK (load_mode = 'NATIVE_ON_DEMAND'),
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
    status TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
    published_by TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (skill_id, version),
    UNIQUE (skill_id, version, content_hash),
    CONSTRAINT chk_skill_publication CHECK (
        status = 'DRAFT' OR (published_by IS NOT NULL AND published_at IS NOT NULL)
    )
);

CREATE TABLE agent_skill_binding (
    agent_id TEXT NOT NULL,
    agent_version TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    skill_version TEXT NOT NULL,
    skill_content_hash TEXT NOT NULL CHECK (skill_content_hash ~ '^sha256:[a-f0-9]{64}$'),
    PRIMARY KEY (agent_id, agent_version, skill_id),
    FOREIGN KEY (agent_id, agent_version) REFERENCES agent_definition(agent_id, version),
    FOREIGN KEY (skill_id, skill_version, skill_content_hash)
        REFERENCES skill_definition(skill_id, version, content_hash)
);

CREATE TABLE skill_applicable_stage (
    skill_id TEXT NOT NULL,
    skill_version TEXT NOT NULL,
    stage_type TEXT NOT NULL CHECK (stage_type IN ('REQUIREMENT','DESIGN','PLANNING','CODING','TESTING','SYSTEM_ACCEPTANCE')),
    PRIMARY KEY (skill_id, skill_version, stage_type),
    FOREIGN KEY (skill_id, skill_version) REFERENCES skill_definition(skill_id, version)
);

ALTER TABLE agent_definition
    ADD CONSTRAINT uq_agent_definition_role_hash UNIQUE (agent_id, version, content_hash, role);

CREATE TABLE stage_submission (
    submission_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES project(project_id),
    stage_type TEXT NOT NULL CHECK (stage_type IN ('REQUIREMENT','DESIGN')),
    source_session_id TEXT NOT NULL REFERENCES factory_session(session_id),
    source_message_id TEXT NOT NULL,
    agent_role TEXT NOT NULL CHECK (agent_role IN ('REQUIREMENT','DESIGN')),
    agent_id TEXT NOT NULL,
    agent_version TEXT NOT NULL,
    agent_content_hash TEXT NOT NULL CHECK (agent_content_hash ~ '^sha256:[a-f0-9]{64}$'),
    model_ref TEXT NOT NULL,
    supersedes_submission_id TEXT REFERENCES stage_submission(submission_id),
    status TEXT NOT NULL CHECK (status IN ('READY_FOR_REVIEW','APPROVED','CHANGES_REQUESTED','SUPERSEDED')),
    submitted_at TIMESTAMPTZ NOT NULL,
    UNIQUE (submission_id, project_id, stage_type),
    FOREIGN KEY (agent_id, agent_version, agent_content_hash, agent_role)
        REFERENCES agent_definition(agent_id, version, content_hash, role),
    CONSTRAINT chk_stage_submission_agent_role CHECK (stage_type = agent_role)
);

CREATE TABLE stage_submission_artifact (
    submission_id TEXT NOT NULL REFERENCES stage_submission(submission_id),
    artifact_type TEXT NOT NULL CHECK (artifact_type IN ('SRS','DESIGN_DOCUMENT','VALIDATION_CONTRACT','CAPABILITY_MAP','DESIGN_SLICE_MANIFEST')),
    artifact_ref TEXT NOT NULL,
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
    PRIMARY KEY (submission_id, artifact_type, artifact_ref)
);

CREATE TABLE stage_submission_skill (
    submission_id TEXT NOT NULL REFERENCES stage_submission(submission_id),
    skill_id TEXT NOT NULL,
    skill_version TEXT NOT NULL,
    skill_content_hash TEXT NOT NULL CHECK (skill_content_hash ~ '^sha256:[a-f0-9]{64}$'),
    PRIMARY KEY (submission_id, skill_id),
    FOREIGN KEY (skill_id, skill_version, skill_content_hash)
        REFERENCES skill_definition(skill_id, version, content_hash)
);

ALTER TABLE stage_gate
    ADD COLUMN stage_submission_id TEXT REFERENCES stage_submission(submission_id);

ALTER TABLE gate_command
    ADD COLUMN stage_submission_ref TEXT REFERENCES stage_submission(submission_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM capability_index_entry WHERE kind = 'SKILL') THEN
        RAISE EXCEPTION 'Legacy SKILL entries must be migrated to skill_definition before V5';
    END IF;
END $$;

ALTER TABLE capability_index_entry
    DROP CONSTRAINT capability_index_entry_kind_check;
ALTER TABLE capability_index_entry
    ADD CONSTRAINT capability_index_entry_kind_check
    CHECK (kind IN ('INTERNAL_TOOL','MCP_TOOL','PLUGIN','REFERENCE_SOURCE','AUTHORITY_SOURCE'));
