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

/**
 * 保留 HTTP 状态与机器错误信封，页面可给出可恢复提示，
 * 但不得从普通异常文本反推 retry 或生命周期动作。
 */
export class ControlPlaneError extends Error {
  constructor(public readonly status: number, public readonly envelope?: ErrorEnvelope) {
    super(envelope?.message ?? `控制平面请求失败（HTTP ${status}）`);
  }
}
