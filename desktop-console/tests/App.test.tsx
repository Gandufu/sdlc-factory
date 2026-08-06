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
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string) => ({
    ok: true,
    json: async () => input.endsWith('/PRJ-REAL-1') ? project : [project],
  })));
});

describe('Factory Desktop Console', () => {
  it('从真实项目目录进入初始化审核', async () => {
    render(<App />);
    expect(screen.getByText('把交付事实放在一条线上。')).toBeInTheDocument();
    fireEvent.click(await screen.findByText('M1 初始化项目'));
    expect(await screen.findByText('项目初始化')).toBeInTheDocument();
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
});
