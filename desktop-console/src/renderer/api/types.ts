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

/**
 * 保留 HTTP 状态与机器错误信封，页面可给出可恢复提示，
 * 但不得从普通异常文本反推 retry 或生命周期动作。
 */
export class ControlPlaneError extends Error {
  constructor(public readonly status: number, public readonly envelope?: ErrorEnvelope) {
    super(envelope?.message ?? `控制平面请求失败（HTTP ${status}）`);
  }
}
