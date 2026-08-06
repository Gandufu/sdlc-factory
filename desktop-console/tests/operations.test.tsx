import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttentionPage } from '../src/renderer/pages/AttentionPage';
import { OperationsPage } from '../src/renderer/pages/OperationsPage';

describe('运行与待处理权威投影', () => {
  it('待处理事项跳转时保留权威目标', () => {
    const onOpen = vi.fn();
    const item = {
      attention_id: 'ATT-1', project_id: 'PRJ-1', run_id: 'RUN-1', scope: '项目初始化',
      category: 'REVIEW' as const, title: '初始化等待人工审核', summary: '核对全部证据',
      occurred_at: '2026-08-06T00:00:00Z', target_type: 'INITIALIZATION' as const, target_id: 'PRJ-1',
    };
    render(<AttentionPage status={{ state: 'ready', checkedAt: '' }} items={[item]} onRefresh={vi.fn()} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: /初始化等待人工审核/ }));

    expect(onOpen).toHaveBeenCalledWith(item);
    expect(screen.queryByText(/演示快照/)).not.toBeInTheDocument();
  });

  it('断线时保留 Run 投影并明确标记非实时', () => {
    render(<OperationsPage status={{ state: 'unavailable', checkedAt: '', detail: 'offline' }}
      board={{ budget: { max_concurrent_runs: 1, per_project_quota: 1, priority_policy: 'FIFO' }, active_count: 1, waiting_runs: [] }}
      runs={[{ run_id: 'RUN-1', project_id: 'PRJ-1', project_name: '项目一', scope: 'PROJECT', authoritative_status: 'RUNNING', lane: 'RUNNING', created_at: '' }]}
      events={[]} streamConnected={false} onRefresh={vi.fn()} />);

    expect(screen.getByText(/上一次成功读取的非实时投影/)).toBeInTheDocument();
    expect(screen.getByText('RUN-1')).toBeInTheDocument();
    expect(screen.getByText('SSE 已断开')).toBeInTheDocument();
  });
});
