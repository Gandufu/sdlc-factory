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
});

describe('Factory Desktop Console', () => {
  it('从项目目录进入项目工作区', async () => {
    render(<App />);
    expect(screen.getByText('把交付事实放在一条线上。')).toBeInTheDocument();
    fireEvent.click(screen.getByText('统一身份平台'));
    expect(await screen.findByText('总体设计等待裁决')).toBeInTheDocument();
    expect(screen.getByText('M0 数据边界')).toBeInTheDocument();
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
