import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/renderer/App';

beforeEach(() => {
  window.desktop = {
    getRuntimeInfo: vi.fn(),
    getControlPlaneStatus: vi.fn().mockResolvedValue({
      state: 'unavailable', checkedAt: '2026-08-06T00:00:00Z', detail: '测试环境未启动控制平面',
    }),
  };
  const project = {
      project_id: 'PRJ-REAL-1', name: 'M1 初始化项目', state: 'AWAITING_REVIEW',
      workspace_path: 'C:/factory/m1', template_id: 'TPL-NODE-BASIC', template_version: '1.0.0',
      updated_at: '2026-08-06T00:00:00Z', initial_git_revision: 'abc123',
      operations: [{ operation: 'READINESS', status: 'SUCCEEDED', runtime_id: 'RTM-1' }],
  };
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string, init?: RequestInit) => ({
    ok: true,
    json: async () => init?.method === 'POST' || input.endsWith('/PRJ-REAL-1') ? project : [project],
  })));
});

describe('Factory Desktop Console', () => {
  it('从真实项目目录进入初始化审核', async () => {
    render(<App />);
    expect(screen.getByText('把交付事实放在一条线上。')).toBeInTheDocument();
    fireEvent.click(await screen.findByText('M1 初始化项目'));
    expect(await screen.findByText('初始化绑定')).toBeInTheDocument();
    expect(await screen.findByText('就绪检查')).toBeInTheDocument();
    expect(screen.getByText('批准初始化并形成基线')).toBeInTheDocument();
  });

  it('控制平面不可用时给出可操作提示', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^运行$/ }));
    expect(await screen.findByText('控制平面尚未就绪')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新检查' })).toBeInTheDocument();
  });

  it('独立浏览器预览没有 preload 时安全降级', async () => {
    delete window.desktop;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection refused')));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^运行$/ }));
    expect(await screen.findByText('控制平面尚未就绪')).toBeInTheDocument();
  });

  it('创建项目时提交绝对工作区路径', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '创建项目' }));
    fireEvent.change(screen.getByLabelText('项目名称'), { target: { value: '绝对路径项目' } });
    fireEvent.change(screen.getByLabelText('项目绝对路径'), { target: { value: 'D:\\workspace\\absolute-project' } });
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    fireEvent.click(screen.getByRole('button', { name: '开始初始化' }));

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/projects', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"workspace_path":"D:\\\\workspace\\\\absolute-project"'),
    })));
  });

  it('人工审核提交审核身份、说明和客户端幂等键', async () => {
    render(<App />);
    fireEvent.click(await screen.findByText('M1 初始化项目'));
    fireEvent.click(await screen.findByRole('button', { name: '批准初始化并形成基线' }));
    fireEvent.change(screen.getByLabelText('审核人'), { target: { value: 'reviewer-01' } });
    fireEvent.change(screen.getByLabelText('审核说明'), { target: { value: '已核对全部初始化证据' } });
    fireEvent.click(screen.getByRole('button', { name: '确认批准并形成基线' }));

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/projects/PRJ-REAL-1/initialization/approve', expect.objectContaining({
      method: 'POST',
      body: expect.stringMatching(/"reviewer_identity":"reviewer-01".*"comments":"已核对全部初始化证据".*"idempotency_key":"[^"]+"/),
    })));
  });

  it('切换项目时不会复用前一个项目的工作区投影', async () => {
    const projects = ['A', 'B'].map((suffix) => ({ project_id: `PRJ-${suffix}`, name: `项目${suffix}`, state: 'APPROVED',
      workspace_path: `D:/workspace/${suffix}`, template_id: 'TPL', template_version: '1.0.0', updated_at: '' }));
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string) => {
      const project = projects.find((item) => input.includes(item.project_id));
      return { ok: true, json: async () => input.endsWith('/api/projects') ? projects : {
        project: { ...project, initialization_state: 'APPROVED' }, lifecycle: [], sessions: [], attention_count: 0,
        gates: [], baselines: [], configuration: { agents: [], runtime_bindings: [], skills: [], mcp: [], plugins: [], permission_policy: 'deny-all', health: 'SUPPORTED_READ_ONLY' },
      } };
    }));
    render(<App />);
    fireEvent.click(await screen.findByText('项目A'));
    expect(await screen.findByRole('heading', { name: '项目A' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '项目' })[0]);
    fireEvent.click(await screen.findByText('项目B'));

    expect(await screen.findByRole('heading', { name: '项目B' })).toBeInTheDocument();
    expect(screen.queryByText('D:/workspace/A')).not.toBeInTheDocument();
  });
});
