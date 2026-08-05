-- AI 软件工厂 v1.2 自包含关系模型基线（PostgreSQL 16+）
-- 本文件可从空数据库执行。它覆盖 v1.2 机器合同所需的最小核心关系，
-- 不是对未来完整实现数据库的不可变承诺。

BEGIN;

CREATE TABLE project (
    project_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    single_operator_exception_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE csci (
    csci_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES project(project_id),
    name TEXT NOT NULL
);

CREATE TABLE capability_unit (
    cu_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES project(project_id),
    name TEXT NOT NULL,
    delivery_status TEXT NOT NULL DEFAULT 'PLANNED'
        CHECK (delivery_status IN ('PLANNED','CODING','TESTING','DELIVERED','ON_HOLD'))
);

CREATE TABLE execution_plan (
    project_id TEXT NOT NULL REFERENCES project(project_id),
    version INTEGER NOT NULL CHECK (version > 0),
    derived_from_design_baseline_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, version)
);

CREATE TABLE execution_plan_cu (
    project_id TEXT NOT NULL,
    execution_plan_version INTEGER NOT NULL,
    cu_id TEXT NOT NULL REFERENCES capability_unit(cu_id),
    business_priority INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, execution_plan_version, cu_id),
    FOREIGN KEY (project_id, execution_plan_version)
        REFERENCES execution_plan(project_id, version)
);

CREATE TABLE run (
    run_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES project(project_id),
    cu_id TEXT REFERENCES capability_unit(cu_id),
    attempt_id TEXT NOT NULL,
    status TEXT NOT NULL
        CHECK (status IN ('QUEUED_FOR_CAPACITY','RUNNING','SUCCEEDED','FAILED','BLOCKED','CANCELLED','TIMED_OUT','NEEDS_REVIEW')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, attempt_id)
);

CREATE TABLE requirement_artifact (
    requirement_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES project(project_id),
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$')
);

CREATE TABLE review_record (
    review_id TEXT PRIMARY KEY,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('PROJECT','CAPABILITY_UNIT')),
    scope_id TEXT NOT NULL,
    stage_type TEXT NOT NULL CHECK (stage_type IN ('REQUIREMENT','DESIGN','CODING','TESTING','SYSTEM_ACCEPTANCE')),
    baseline_candidate_ref TEXT NOT NULL,
    source_revision TEXT,
    reviewer_identity TEXT NOT NULL,
    reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('DEVELOPER','REVIEWER','RELEASE_MANAGER')),
    primary_executor_id TEXT,
    separation_policy TEXT NOT NULL CHECK (separation_policy IN ('ENFORCED','SINGLE_OPERATOR_EXCEPTION')),
    exception_reason TEXT,
    decision TEXT NOT NULL CHECK (decision IN ('APPROVED','CHANGES_REQUESTED')),
    comments TEXT NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    CONSTRAINT chk_review_stage_scope CHECK (
        (stage_type IN ('REQUIREMENT','DESIGN','SYSTEM_ACCEPTANCE') AND scope_type = 'PROJECT') OR
        (stage_type IN ('CODING','TESTING') AND scope_type = 'CAPABILITY_UNIT' AND primary_executor_id IS NOT NULL)
    ),
    CONSTRAINT chk_review_separation CHECK (
        (separation_policy = 'ENFORCED' AND (primary_executor_id IS NULL OR reviewer_identity <> primary_executor_id)) OR
        (separation_policy = 'SINGLE_OPERATOR_EXCEPTION' AND primary_executor_id IS NOT NULL AND exception_reason IS NOT NULL AND length(exception_reason) > 0)
    )
);

CREATE TABLE review_artifact_hash (
    review_id TEXT NOT NULL REFERENCES review_record(review_id),
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
    PRIMARY KEY (review_id, content_hash)
);

CREATE TABLE baseline (
    baseline_id TEXT PRIMARY KEY,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('PROJECT','CAPABILITY_UNIT')),
    scope_id TEXT NOT NULL,
    baseline_type TEXT NOT NULL CHECK (baseline_type IN ('INITIALIZATION','REQUIREMENT','DESIGN','CODE','TEST','SYSTEM_ACCEPTANCE')),
    artifact_version INTEGER NOT NULL CHECK (artifact_version > 0),
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
    source_revision TEXT,
    review_record_id TEXT NOT NULL REFERENCES review_record(review_id),
    signature_ref TEXT,
    validity_status TEXT NOT NULL CHECK (validity_status IN ('VALID','STALE','IMPACT_REVIEW_REQUIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_baseline_type_scope CHECK (
        (baseline_type IN ('INITIALIZATION','REQUIREMENT','DESIGN','SYSTEM_ACCEPTANCE') AND scope_type = 'PROJECT') OR
        (baseline_type IN ('CODE','TEST') AND scope_type = 'CAPABILITY_UNIT')
    )
);

ALTER TABLE execution_plan
    ADD CONSTRAINT fk_execution_plan_design_baseline
    FOREIGN KEY (derived_from_design_baseline_id) REFERENCES baseline(baseline_id);

CREATE TABLE baseline_item (
    baseline_id TEXT NOT NULL REFERENCES baseline(baseline_id),
    artifact_type TEXT NOT NULL,
    artifact_ref TEXT NOT NULL,
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
    PRIMARY KEY (baseline_id, artifact_type, artifact_ref)
);

CREATE TABLE baseline_reference_binding (
    baseline_id TEXT NOT NULL REFERENCES baseline(baseline_id),
    reference_binding_ref TEXT NOT NULL,
    PRIMARY KEY (baseline_id, reference_binding_ref)
);

CREATE TABLE environment_profile (
    environment_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES project(project_id),
    environment_type TEXT NOT NULL CHECK (environment_type IN ('DEV','SIT','UAT','DEVICE_LAB')),
    owner_identity TEXT NOT NULL
);

CREATE TABLE environment_binding_snapshot (
    environment_binding_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES run(run_id),
    environment_id TEXT NOT NULL REFERENCES environment_profile(environment_id),
    code_revision TEXT NOT NULL,
    configuration_hash TEXT NOT NULL CHECK (configuration_hash ~ '^sha256:[a-f0-9]{64}$'),
    bound_at TIMESTAMPTZ NOT NULL,
    binding_status TEXT NOT NULL CHECK (binding_status IN ('BOUND','STALE','UNAVAILABLE'))
);

CREATE TABLE interface_definition (
    interface_id TEXT NOT NULL,
    version TEXT NOT NULL CHECK (version ~ '^\d+\.\d+\.\d+$'),
    classification TEXT NOT NULL CHECK (classification IN ('INTRA_CSCI','INTER_CSCI_INTERNAL','EXTERNAL_SYSTEM')),
    provider TEXT NOT NULL,
    owning_csci_id TEXT NOT NULL REFERENCES csci(csci_id),
    protocol TEXT NOT NULL,
    request_schema_ref TEXT,
    response_schema_ref TEXT,
    authentication TEXT NOT NULL,
    error_model TEXT NOT NULL,
    timeout_ms INTEGER NOT NULL CHECK (timeout_ms > 0),
    availability_requirement TEXT NOT NULL,
    compatibility_policy TEXT NOT NULL CHECK (compatibility_policy IN ('BACKWARD','FORWARD','FULL','NONE')),
    baseline_status TEXT NOT NULL CHECK (baseline_status IN ('UNBASELINED','BASELINED','STALE')),
    status TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','DEPRECATED')),
    published_from_design_baseline_id TEXT REFERENCES baseline(baseline_id),
    superseded_by_interface_id TEXT,
    superseded_by_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (interface_id, version),
    FOREIGN KEY (superseded_by_interface_id, superseded_by_version)
        REFERENCES interface_definition(interface_id, version),
    CONSTRAINT chk_interface_published_baseline CHECK (status <> 'PUBLISHED' OR published_from_design_baseline_id IS NOT NULL),
    CONSTRAINT chk_interface_deprecated_successor CHECK (status <> 'DEPRECATED' OR (superseded_by_interface_id IS NOT NULL AND superseded_by_version IS NOT NULL))
);

CREATE TABLE interface_consumer (
    interface_id TEXT NOT NULL,
    interface_version TEXT NOT NULL,
    cu_id TEXT NOT NULL REFERENCES capability_unit(cu_id),
    PRIMARY KEY (interface_id, interface_version, cu_id),
    FOREIGN KEY (interface_id, interface_version)
        REFERENCES interface_definition(interface_id, version)
);

CREATE TABLE interface_related_cu (
    interface_id TEXT NOT NULL,
    interface_version TEXT NOT NULL,
    cu_id TEXT NOT NULL REFERENCES capability_unit(cu_id),
    PRIMARY KEY (interface_id, interface_version, cu_id),
    FOREIGN KEY (interface_id, interface_version)
        REFERENCES interface_definition(interface_id, version)
);

CREATE TABLE interface_operation (
    interface_id TEXT NOT NULL,
    interface_version TEXT NOT NULL,
    operation TEXT NOT NULL,
    PRIMARY KEY (interface_id, interface_version, operation),
    FOREIGN KEY (interface_id, interface_version)
        REFERENCES interface_definition(interface_id, version)
);

CREATE TABLE interface_environment_binding (
    interface_id TEXT NOT NULL,
    interface_version TEXT NOT NULL,
    environment_id TEXT NOT NULL REFERENCES environment_profile(environment_id),
    PRIMARY KEY (interface_id, interface_version, environment_id),
    FOREIGN KEY (interface_id, interface_version)
        REFERENCES interface_definition(interface_id, version)
);

CREATE TABLE prompt_template (
    prompt_id TEXT NOT NULL,
    version TEXT NOT NULL CHECK (version ~ '^\d+\.\d+\.\d+$'),
    applicable_stage TEXT NOT NULL CHECK (applicable_stage IN ('REQUIREMENT','DESIGN','CODING','TESTING','SYSTEM_ACCEPTANCE')),
    content_ref TEXT NOT NULL,
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
    status TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
    published_by TEXT,
    published_at TIMESTAMPTZ,
    publication_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (prompt_id, version),
    UNIQUE (prompt_id, version, content_hash),
    CONSTRAINT chk_prompt_publication CHECK (status = 'DRAFT' OR (published_by IS NOT NULL AND published_at IS NOT NULL AND publication_reason IS NOT NULL))
);

CREATE TABLE agent_definition (
    agent_id TEXT NOT NULL,
    version TEXT NOT NULL CHECK (version ~ '^\d+\.\d+\.\d+$'),
    role TEXT NOT NULL CHECK (role IN ('REQUIREMENT','DESIGN','CODER','TESTER','REVIEWER_ASSISTANT')),
    model_binding_ref TEXT NOT NULL,
    prompt_id TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    prompt_content_hash TEXT NOT NULL CHECK (prompt_content_hash ~ '^sha256:[a-f0-9]{64}$'),
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
    status TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
    published_by TEXT,
    published_at TIMESTAMPTZ,
    publication_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (agent_id, version),
    UNIQUE (agent_id, version, content_hash),
    FOREIGN KEY (prompt_id, prompt_version, prompt_content_hash)
        REFERENCES prompt_template(prompt_id, version, content_hash),
    CONSTRAINT chk_agent_publication CHECK (status = 'DRAFT' OR (published_by IS NOT NULL AND published_at IS NOT NULL AND publication_reason IS NOT NULL))
);

CREATE TABLE agent_capability_tag (
    agent_id TEXT NOT NULL,
    agent_version TEXT NOT NULL,
    capability_tag TEXT NOT NULL,
    PRIMARY KEY (agent_id, agent_version, capability_tag),
    FOREIGN KEY (agent_id, agent_version)
        REFERENCES agent_definition(agent_id, version)
);

CREATE TABLE rule_set (
    ruleset_id TEXT NOT NULL,
    version TEXT NOT NULL CHECK (version ~ '^\d+\.\d+\.\d+$'),
    applicable_stage TEXT NOT NULL CHECK (applicable_stage IN ('REQUIREMENT','DESIGN','CODING','TESTING','SYSTEM_ACCEPTANCE')),
    content_ref TEXT NOT NULL,
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),
    status TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
    published_by TEXT,
    published_at TIMESTAMPTZ,
    publication_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (ruleset_id, version),
    UNIQUE (ruleset_id, version, content_hash),
    CONSTRAINT chk_ruleset_publication CHECK (status = 'DRAFT' OR (published_by IS NOT NULL AND published_at IS NOT NULL AND publication_reason IS NOT NULL))
);

CREATE TABLE rule_set_stack_tag (
    ruleset_id TEXT NOT NULL,
    ruleset_version TEXT NOT NULL,
    stack_tag TEXT NOT NULL,
    PRIMARY KEY (ruleset_id, ruleset_version, stack_tag),
    FOREIGN KEY (ruleset_id, ruleset_version)
        REFERENCES rule_set(ruleset_id, version)
);

CREATE TABLE template_registration (
    template_id TEXT NOT NULL,
    version TEXT NOT NULL CHECK (version ~ '^\d+\.\d+\.\d+$'),
    descriptor_ref TEXT NOT NULL,
    digest TEXT NOT NULL CHECK (digest ~ '^sha256:[a-f0-9]{64}$'),
    status TEXT NOT NULL CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
    published_by TEXT,
    published_at TIMESTAMPTZ,
    publication_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (template_id, version),
    UNIQUE (template_id, version, digest),
    CONSTRAINT chk_template_publication CHECK (status = 'DRAFT' OR (published_by IS NOT NULL AND published_at IS NOT NULL AND publication_reason IS NOT NULL))
);

CREATE TABLE template_binding (
    project_id TEXT PRIMARY KEY REFERENCES project(project_id),
    template_id TEXT NOT NULL,
    template_version TEXT NOT NULL,
    template_digest TEXT NOT NULL CHECK (template_digest ~ '^sha256:[a-f0-9]{64}$'),
    bound_at TIMESTAMPTZ NOT NULL,
    binding_reason TEXT NOT NULL,
    FOREIGN KEY (template_id, template_version, template_digest)
        REFERENCES template_registration(template_id, version, digest)
);

CREATE TABLE environment_requirement (
    environment_requirement_id TEXT PRIMARY KEY,
    requirement_id TEXT NOT NULL REFERENCES requirement_artifact(requirement_id),
    kind TEXT NOT NULL CHECK (kind IN ('DEVICE','THIRD_PARTY_API','EXTERNAL_SYSTEM','DATA_FIXTURE','SECRET')),
    description TEXT NOT NULL,
    required_for_stage TEXT NOT NULL CHECK (required_for_stage IN ('CODING','TESTING','SYSTEM_ACCEPTANCE')),
    probe_id TEXT,
    probe_type TEXT CHECK (probe_type IN ('COMMAND_TEMPLATE','HTTP','TCP','RESOURCE_LOOKUP')),
    probe_ref TEXT,
    probe_timeout_ms INTEGER CHECK (probe_timeout_ms > 0),
    expected_result TEXT,
    CONSTRAINT chk_environment_probe_complete CHECK (
        (probe_id IS NULL AND probe_type IS NULL AND probe_ref IS NULL AND probe_timeout_ms IS NULL AND expected_result IS NULL) OR
        (probe_id IS NOT NULL AND probe_type IS NOT NULL AND probe_ref IS NOT NULL AND probe_timeout_ms IS NOT NULL AND expected_result IS NOT NULL)
    )
);

CREATE TABLE factory_run_budget (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    max_concurrent_runs INTEGER NOT NULL DEFAULT 1 CHECK (max_concurrent_runs = 1),
    per_project_quota INTEGER NOT NULL DEFAULT 1 CHECK (per_project_quota = 1),
    priority_policy TEXT NOT NULL DEFAULT 'DEPENDENCY_THEN_BUSINESS_PRIORITY_THEN_FIFO'
        CHECK (priority_policy = 'DEPENDENCY_THEN_BUSINESS_PRIORITY_THEN_FIFO')
);

INSERT INTO factory_run_budget DEFAULT VALUES;

CREATE TABLE factory_run_queue (
    run_id TEXT PRIMARY KEY REFERENCES run(run_id),
    project_id TEXT NOT NULL REFERENCES project(project_id),
    dependency_rank INTEGER NOT NULL DEFAULT 0,
    business_priority INTEGER NOT NULL DEFAULT 0,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    queue_status TEXT NOT NULL DEFAULT 'QUEUED_FOR_CAPACITY'
        CHECK (queue_status IN ('QUEUED_FOR_CAPACITY','DISPATCHED','CANCELLED'))
);

CREATE TABLE system_acceptance (
    system_acceptance_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    release_scope_id TEXT NOT NULL,
    execution_plan_version INTEGER NOT NULL,
    system_integration_run_id TEXT REFERENCES run(run_id),
    environment_binding_ref TEXT REFERENCES environment_binding_snapshot(environment_binding_id),
    review_record_id TEXT REFERENCES review_record(review_id),
    status TEXT NOT NULL CHECK (status IN ('DRAFT','RUNNING','AWAITING_REVIEW','APPROVED','CHANGES_REQUESTED','STALE')),
    invalidated_at TIMESTAMPTZ,
    invalidation_reason TEXT,
    invalidation_trigger_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (project_id, execution_plan_version)
        REFERENCES execution_plan(project_id, version),
    CONSTRAINT chk_system_acceptance_run_binding CHECK (status = 'DRAFT' OR status = 'STALE' OR (system_integration_run_id IS NOT NULL AND environment_binding_ref IS NOT NULL)),
    CONSTRAINT chk_system_acceptance_review CHECK (status <> 'APPROVED' OR review_record_id IS NOT NULL),
    CONSTRAINT chk_system_acceptance_stale CHECK (status <> 'STALE' OR (invalidated_at IS NOT NULL AND invalidation_reason IS NOT NULL AND invalidation_trigger_ref IS NOT NULL))
);

CREATE TABLE system_acceptance_cu_baseline (
    system_acceptance_id TEXT NOT NULL REFERENCES system_acceptance(system_acceptance_id),
    cu_id TEXT NOT NULL REFERENCES capability_unit(cu_id),
    code_baseline_id TEXT NOT NULL REFERENCES baseline(baseline_id),
    test_baseline_id TEXT NOT NULL REFERENCES baseline(baseline_id),
    PRIMARY KEY (system_acceptance_id, cu_id)
);

CREATE TABLE system_acceptance_scenario (
    system_acceptance_id TEXT NOT NULL REFERENCES system_acceptance(system_acceptance_id),
    scenario_ref TEXT NOT NULL,
    PRIMARY KEY (system_acceptance_id, scenario_ref)
);

CREATE TABLE system_acceptance_baseline (
    baseline_id TEXT PRIMARY KEY REFERENCES baseline(baseline_id),
    system_acceptance_id TEXT NOT NULL UNIQUE REFERENCES system_acceptance(system_acceptance_id),
    project_id TEXT NOT NULL,
    release_scope_id TEXT NOT NULL,
    execution_plan_version INTEGER NOT NULL,
    environment_binding_ref TEXT NOT NULL REFERENCES environment_binding_snapshot(environment_binding_id),
    FOREIGN KEY (project_id, execution_plan_version)
        REFERENCES execution_plan(project_id, version)
);

CREATE TABLE system_acceptance_baseline_cu (
    baseline_id TEXT NOT NULL REFERENCES system_acceptance_baseline(baseline_id),
    cu_id TEXT NOT NULL REFERENCES capability_unit(cu_id),
    code_baseline_id TEXT NOT NULL REFERENCES baseline(baseline_id),
    test_baseline_id TEXT NOT NULL REFERENCES baseline(baseline_id),
    PRIMARY KEY (baseline_id, cu_id)
);

CREATE TABLE system_acceptance_interface_binding (
    baseline_id TEXT NOT NULL REFERENCES system_acceptance_baseline(baseline_id),
    interface_id TEXT NOT NULL,
    interface_version TEXT NOT NULL,
    PRIMARY KEY (baseline_id, interface_id, interface_version),
    FOREIGN KEY (interface_id, interface_version)
        REFERENCES interface_definition(interface_id, version)
);

CREATE TABLE system_acceptance_evidence (
    baseline_id TEXT NOT NULL REFERENCES system_acceptance_baseline(baseline_id),
    evidence_ref TEXT NOT NULL,
    PRIMARY KEY (baseline_id, evidence_ref)
);

CREATE TABLE factory_trajectory_event (
    event_id TEXT PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL,
    project_id TEXT NOT NULL,
    cu_id TEXT,
    slice_id TEXT,
    run_id TEXT NOT NULL,
    attempt_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    agent_version TEXT NOT NULL,
    agent_content_hash TEXT NOT NULL CHECK (agent_content_hash ~ '^sha256:[a-f0-9]{64}$'),
    prompt_id TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    prompt_content_hash TEXT NOT NULL CHECK (prompt_content_hash ~ '^sha256:[a-f0-9]{64}$'),
    ruleset_id TEXT NOT NULL,
    ruleset_version TEXT NOT NULL,
    ruleset_content_hash TEXT NOT NULL CHECK (ruleset_content_hash ~ '^sha256:[a-f0-9]{64}$'),
    model_ref TEXT NOT NULL,
    tool_schema_version TEXT NOT NULL,
    context_bundle_hash TEXT NOT NULL CHECK (context_bundle_hash ~ '^sha256:[a-f0-9]{64}$'),
    outcome TEXT NOT NULL CHECK (outcome IN ('PASSED','FAILED','BLOCKED','CANCELLED')),
    event_type TEXT NOT NULL,
    payload_ref TEXT,
    UNIQUE (run_id, attempt_id, event_id),
    FOREIGN KEY (project_id) REFERENCES project(project_id),
    FOREIGN KEY (cu_id) REFERENCES capability_unit(cu_id),
    FOREIGN KEY (run_id, attempt_id) REFERENCES run(run_id, attempt_id),
    FOREIGN KEY (agent_id, agent_version, agent_content_hash) REFERENCES agent_definition(agent_id, version, content_hash),
    FOREIGN KEY (prompt_id, prompt_version, prompt_content_hash) REFERENCES prompt_template(prompt_id, version, content_hash),
    FOREIGN KEY (ruleset_id, ruleset_version, ruleset_content_hash) REFERENCES rule_set(ruleset_id, version, content_hash)
);

CREATE TABLE factory_trajectory_authority_ref (
    event_id TEXT NOT NULL REFERENCES factory_trajectory_event(event_id),
    authority_ref TEXT NOT NULL,
    PRIMARY KEY (event_id, authority_ref)
);

CREATE FUNCTION reject_factory_trajectory_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'factory_trajectory_event is append-only';
END;
$$;

CREATE TRIGGER factory_trajectory_event_append_only
BEFORE UPDATE OR DELETE ON factory_trajectory_event
FOR EACH ROW EXECUTE FUNCTION reject_factory_trajectory_mutation();

CREATE TRIGGER factory_trajectory_authority_ref_append_only
BEFORE UPDATE OR DELETE ON factory_trajectory_authority_ref
FOR EACH ROW EXECUTE FUNCTION reject_factory_trajectory_mutation();

COMMIT;
