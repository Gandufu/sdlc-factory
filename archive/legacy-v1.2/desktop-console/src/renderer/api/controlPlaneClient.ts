import type { ControlPlaneStatus } from '../../shared/contracts';
import { ControlPlaneError, type AttentionItem, type CapacityBoard, type CreateProjectInput,
  type ErrorEnvelope, type InitializationApprovalInput, type ProjectSummary, type RunEvent,
  type ProjectWorkspaceProjection, type RunProjection, type SessionProjection } from './types';

const productionOrigin = 'http://127.0.0.1:8420';
const baseUrl = import.meta.env.DEV ? '' : productionOrigin;

/** 统一解析 snake_case REST 合同与 ErrorEnvelope，避免页面散落 fetch 细节。 */
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    let envelope: ErrorEnvelope | undefined;
    try { envelope = await response.json() as ErrorEnvelope; } catch { /* 非结构化网络边界错误 */ }
    throw new ControlPlaneError(response.status, envelope);
  }
  return response.json() as Promise<T>;
};

export const controlPlaneClient = {
  getCapacityBoard: () => request<CapacityBoard>('/api/capacity/board'),
  getRunBoard: () => request<RunProjection[]>('/api/runs/board'),
  getAttention: () => request<AttentionItem[]>('/api/attention'),
  getWorkspace: (projectId: string) => request<ProjectWorkspaceProjection>(`/api/projects/${projectId}/workspace`),
  getSession: (projectId: string, sessionId: string) => request<SessionProjection>(`/api/projects/${projectId}/sessions/${sessionId}`),
  createSession: (projectId: string, input: { parent_session_id?: string; agent: string; title: string }) =>
    request<SessionProjection>(`/api/projects/${projectId}/sessions`, { method: 'POST', body: JSON.stringify(input) }),
  archiveSession: (projectId: string, sessionId: string) => request<SessionProjection>(`/api/projects/${projectId}/sessions/${sessionId}/archive`, { method: 'POST' }),
  sendSessionMessage: (projectId: string, sessionId: string, content: string) => request<SessionProjection>(`/api/projects/${projectId}/sessions/${sessionId}/messages`, {
    method: 'POST', body: JSON.stringify({ content }),
  }),
  decideWorkspaceGate: (projectId: string, gateId: string, action: 'approve' | 'request-changes', expectedVersion: number, reviewer: string, comments: string) =>
    request<ProjectWorkspaceProjection>(`/api/projects/${projectId}/gates/${gateId}/${action}`, { method: 'POST', body: JSON.stringify({
      reviewer_identity: reviewer, comments, expected_version: expectedVersion,
      idempotency_key: `GATE-${gateId}-${crypto.randomUUID()}`,
    }) }),
  recoverRun: (projectId: string, sessionId: string, runId: string) => request<SessionProjection>(`/api/projects/${projectId}/sessions/${sessionId}/runs/${runId}/recover`, { method: 'POST' }),
  getProjects: () => request<ProjectSummary[]>('/api/projects'),
  getProject: (projectId: string) => request<ProjectSummary>(`/api/projects/${projectId}`),
  createProject: (input: CreateProjectInput) => request<ProjectSummary>('/api/projects', {
    method: 'POST', body: JSON.stringify(input),
  }),
  approveInitialization: (projectId: string, input: InitializationApprovalInput) => request<ProjectSummary>(`/api/projects/${projectId}/initialization/approve`, {
    method: 'POST', body: JSON.stringify({
      ...input,
      idempotency_key: `INIT-${projectId}-${crypto.randomUUID()}`,
    }),
  }),
  transition: (state: string, command: string, reason?: string) =>
    request<{ previous_state: string; new_state: string }>('/api/lifecycle/transitions', {
      method: 'POST', body: JSON.stringify({ state, command, reason }),
    }),
};

/**
 * Electron 运行时由 Main 进程执行 readiness；独立浏览器预览没有 preload，
 * 改走同源 Vite 代理。两条路径都只生成连接提示，不产生领域事实。
 */
export const inspectControlPlaneStatus = async (): Promise<ControlPlaneStatus> => {
  if (window.desktop) return window.desktop.getControlPlaneStatus();
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(`${baseUrl}/actuator/health`, { signal: AbortSignal.timeout(1500) });
    const body = response.ok ? await response.json() as { status?: string } : undefined;
    return body?.status === 'UP'
      ? { state: 'ready', checkedAt }
      : { state: 'unavailable', checkedAt, detail: `健康检查返回 HTTP ${response.status}` };
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : '无法连接控制平面';
    return { state: 'unavailable', checkedAt, detail };
  }
};

/**
 * SSE 是可丢失的观测通道：非法事件直接丢弃，断线只更新连接提示，
 * 绝不能据此推进 Run、Gate 或 Baseline。
 */
export const subscribeRunEvents = (
  onEvent: (event: RunEvent) => void,
  onConnectionChange: (connected: boolean) => void,
): (() => void) => {
  const source = new EventSource(`${baseUrl}/api/runs/events`);
  source.onopen = () => onConnectionChange(true);
  source.onerror = () => onConnectionChange(false);
  source.addEventListener('run-event', (message) => {
    try { onEvent(JSON.parse(message.data) as RunEvent); } catch { /* 丢弃非法观测事件，不改变领域状态 */ }
  });
  return () => source.close();
};
