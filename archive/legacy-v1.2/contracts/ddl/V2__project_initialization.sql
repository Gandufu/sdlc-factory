-- M1 项目初始化状态与审核扩展。
-- 运行输出仍写入 V1 的 run/evidence/execution_result；本表只保存初始化聚合状态。

CREATE TABLE project_initialization (
    project_id TEXT PRIMARY KEY REFERENCES project(project_id),
    run_id TEXT NOT NULL REFERENCES run(run_id),
    state TEXT NOT NULL CHECK (state IN (
        'DRAFT','TEMPLATE_SELECTED','INSTANTIATING','VALIDATING',
        'AWAITING_REVIEW','APPROVED','CHANGES_REQUESTED','ON_HOLD','FAILED')),
    workspace_path TEXT NOT NULL,
    template_parameters_hash TEXT NOT NULL CHECK (template_parameters_hash ~ '^sha256:[a-f0-9]{64}$'),
    project_manifest JSONB,
    module_topology JSONB,
    initial_git_revision TEXT,
    failure_detail TEXT,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE review_record DROP CONSTRAINT chk_review_stage_scope;
ALTER TABLE review_record DROP CONSTRAINT review_record_stage_type_check;
ALTER TABLE review_record ADD CONSTRAINT review_record_stage_type_check
    CHECK (stage_type IN ('INITIALIZATION','REQUIREMENT','DESIGN','CODING','TESTING','SYSTEM_ACCEPTANCE'));
ALTER TABLE review_record ADD CONSTRAINT chk_review_stage_scope CHECK (
    (stage_type IN ('INITIALIZATION','REQUIREMENT','DESIGN','SYSTEM_ACCEPTANCE') AND scope_type = 'PROJECT') OR
    (stage_type IN ('CODING','TESTING') AND scope_type = 'CAPABILITY_UNIT' AND primary_executor_id IS NOT NULL)
);
