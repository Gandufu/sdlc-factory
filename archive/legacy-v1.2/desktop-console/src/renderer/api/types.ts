export type ErrorEnvelope = {
  error_id: string;
  run_id: string;
  code: string;
  message: string;
  retryable: boolean;
  details: Record<string, unknown>;
};

export type CapacityBoard = {
  budget: {
    max_concurrent_runs: number;
    per_project_quota: number;
    priority_policy: string;
  };
  active_count: number;
  waiting_runs: string[];
};

export type RunEvent = {
  event_id?: string;
  run_id?: string;
  type?: string;
  occurred_at?: string;
  [key: string]: unknown;
};

export type RunProjection = {
  run_id: string;
  project_id: string;
  project_name: string;
  scope: string;
  authoritative_status: string;
  lane: 'READY' | 'RUNNING' | 'WAITING_FOR_HUMAN' | 'BLOCKED' | 'COMPLETED';
  created_at: string;
};

export type AttentionItem = {
  attention_id: string;
  project_id: string;
  run_id?: string;
  scope: string;
  category: 'REVIEW' | 'BLOCKED' | 'INTERVENTION';
  title: string;
  summary: string;
  occurred_at: string;
  target_type: 'INITIALIZATION' | 'STAGE' | 'RUN';
  target_id: string;
};

export type ProjectSummary = {
  project_id: string;
  name: string;
  state: 'AWAITING_REVIEW' | 'APPROVED' | 'FAILED' | string;
  workspace_path: string;
  template_id: string;
  template_version: string;
  updated_at: string;
  initial_git_revision?: string;
  template_digest?: string;
  failure_detail?: string;
  operations?: InitializationOperation[];
};

export type InitializationOperation = {
  operation: string;
  status: string;
  test_outcome?: string;
  exit_code?: number;
  runtime_id?: string;
  content_hash?: string;
  completed_at?: string;
};

export type CreateProjectInput = {
  project_name: string;
  workspace_path: string;
  template_id: string;
  template_version: string;
};

export type InitializationApprovalInput = {
  reviewer_identity: string;
  comments: string;
};

export type LifecycleStageProjection = { stage: string; status: 'PENDING' | 'ACTIVE' | 'COMPLETED' };

export type SessionSummary = {
  session_id: string;
  parent_session_id?: string;
  run_ids: string[];
  agent: string;
  title: string;
  state: 'ACTIVE' | 'WAITING' | 'COMPLETED' | 'BLOCKED';
  current: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type SessionMessage = {
  message_id: string;
  role: 'OPERATOR' | 'AGENT' | 'SYSTEM';
  content: string;
  run_id?: string;
  created_at: string;
};

export type ArtifactReference = {
  artifact_id: string;
  artifact_type: string;
  artifact_ref: string;
  content_hash: string;
  run_id?: string;
  created_at?: string;
};

export type GateProjection = {
  gate_id: string;
  session_id: string;
  run_id: string;
  gate_type: string;
  expected_version: number;
  status: 'WAITING' | 'APPROVED' | 'CHANGES_REQUESTED';
  candidate_artifacts: ArtifactReference[];
  handoff?: { handoff_id: string; payload: string };
  deterministic_checks: Array<Record<string, unknown>>;
  environment_bindings: Array<Record<string, unknown>>;
  open_questions: Array<Record<string, unknown>>;
  evidence: ArtifactReference[];
};

export type WorkspaceConfiguration = {
  agents: Array<Record<string, unknown>>;
  runtime_bindings: Array<Record<string, unknown>>;
  skills: Array<Record<string, unknown>>;
  mcp: Array<Record<string, unknown>>;
  plugins: Array<Record<string, unknown>>;
  permission_policy: string;
  health: string;
};

export type ProjectWorkspaceProjection = {
  project: ProjectSummary & { initialization_state: string };
  lifecycle: LifecycleStageProjection[];
  sessions: SessionSummary[];
  attention_count: number;
  gates: GateProjection[];
  baselines: Array<Record<string, unknown>>;
  configuration: WorkspaceConfiguration;
};

export type SessionProjection = SessionSummary & {
  messages: SessionMessage[];
  artifacts: ArtifactReference[];
  gates: GateProjection[];
  runs: Array<{ run_id: string; status: string; created_at: string }>;
};

/**
 * 保留 HTTP 状态与机器错误信封，页面可给出可恢复提示，
 * 但不得从普通异常文本反推 retry 或生命周期动作。
 */
export class ControlPlaneError extends Error {
  constructor(public readonly status: number, public readonly envelope?: ErrorEnvelope) {
    super(envelope?.message ?? `控制平面请求失败（HTTP ${status}）`);
  }
}
