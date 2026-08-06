import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspacePage } from '../src/renderer/pages/WorkspacePage';

const sessions = [
  { session_id: 'SES-CURRENT', run_ids: ['RUN-1'], agent: 'opencode-luna-max', title: '当前会话', state: 'ACTIVE', current: true, archived: false, created_at: '', updated_at: '' },
  { session_id: 'SES-HISTORY', run_ids: ['RUN-OLD'], agent: 'opencode-luna-max', title: '历史会话', state: 'COMPLETED', current: false, archived: true, created_at: '', updated_at: '' },
];

const workspace = {
  project: { project_id: 'PRJ-1', name: '真实项目', initialization_state: 'APPROVED', state: 'APPROVED', workspace_path: 'D:/workspace/real', template_id: 'TPL', template_version: '1.0.0', template_digest: 'sha256:x', updated_at: '', initial_git_revision: 'abc123' },
  lifecycle: [{ stage: 'INITIALIZATION', status: 'COMPLETED' }], sessions, attention_count: 0, gates: [], baselines: [],
  configuration: { agents: [], runtime_bindings: [], skills: [], mcp: [], plugins: [], permission_policy: 'deny-all', health: 'SUPPORTED_READ_ONLY' },
};

const detail = (sessionId: string) => ({ ...sessions.find((item) => item.session_id === sessionId), messages: [], artifacts: [], gates: [], runs: [] });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string) => ({
    ok: true,
    json: async () => input.endsWith('/workspace') ? workspace : detail(input.includes('SES-HISTORY') ? 'SES-HISTORY' : 'SES-CURRENT'),
  })));
});

describe('连续会话项目工作区', () => {
  it('历史 Session 只读且不能发送消息', async () => {
    render(<WorkspacePage projectId="PRJ-1" onBack={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: '当前会话' })).toBeInTheDocument();
    expect(screen.getByLabelText('持续会话消息')).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /历史会话/ }));

    await vi.waitFor(() => expect(screen.getByLabelText('持续会话消息')).toBeDisabled());
    expect(screen.getByPlaceholderText('历史或归档会话只读')).toBeInTheDocument();
  });

  it('生命周期和 Session 作为独立投影展示', async () => {
    render(<WorkspacePage projectId="PRJ-1" onBack={vi.fn()} />);
    expect(await screen.findByText('初始化')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '当前会话' })).toBeInTheDocument();
  });

  it('Gate 命令携带权威 expected_version 和审核输入', async () => {
    const gate = { gate_id: 'GAT-1', session_id: 'SES-CURRENT', run_id: 'RUN-1', gate_type: 'SYSTEM_ACCEPTANCE',
      expected_version: 3, status: 'WAITING', candidate_artifacts: [], deterministic_checks: [], environment_bindings: [], open_questions: [], evidence: [] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string, init?: RequestInit) => ({
      ok: true,
      json: async () => input.endsWith('/workspace') ? { ...workspace, gates: [gate] }
        : init?.method === 'POST' ? workspace : { ...detail('SES-CURRENT'), gates: [gate] },
    })));
    render(<WorkspacePage projectId="PRJ-1" onBack={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('审核人'), { target: { value: 'reviewer-02' } });
    fireEvent.change(screen.getByLabelText('审核说明'), { target: { value: '同意形成基线' } });
    fireEvent.click(screen.getByRole('button', { name: '批准 Gate' }));

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/projects/PRJ-1/gates/GAT-1/approve', expect.objectContaining({
      method: 'POST', body: expect.stringContaining('"expected_version":3'),
    })));
  });
});
