import type { ReactNode } from 'react';
import type { ControlPlaneStatus } from '../../shared/contracts';

export type View = 'projects' | 'attention' | 'operations' | 'workspace' | 'initialization';

const navItems: Array<{ id: Exclude<View, 'workspace' | 'initialization'>; label: string; glyph: string }> = [
  { id: 'projects', label: '项目', glyph: '▦' },
  { id: 'attention', label: '待处理', glyph: '!' },
  { id: 'operations', label: '运行', glyph: '▶' },
];

export const AppShell = ({
  view, status, onNavigate, onRefresh, children,
}: {
  view: View;
  status: ControlPlaneStatus;
  onNavigate: (view: View) => void;
  onRefresh: () => void;
  children: ReactNode;
}) => (
  <div className="app-shell">
    <aside className="global-nav">
      <button className="brand" onClick={() => onNavigate('projects')} aria-label="返回项目">
        <span className="brand-mark">F</span><strong>Factory</strong>
      </button>
      <nav aria-label="主导航">
        {navItems.map((item) => (
          <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>
            <span aria-hidden="true">{item.glyph}</span>{item.label}
          </button>
        ))}
      </nav>
      <div className="operator"><span>G</span><div><strong>操作员</strong><small>最终裁决人</small></div></div>
    </aside>
    <section className="app-body">
      <header className="command-bar">
        <div><span className="command-label">CONTROL PLANE</span><strong>本地控制平面</strong></div>
        <button className={`health ${status.state}`} onClick={onRefresh}>
          <i />{status.state === 'ready' ? '已就绪' : '未连接'}<span>重新检查</span>
        </button>
      </header>
      {children}
    </section>
  </div>
);

export const FixtureBadge = () => <span className="fixture-badge">M0 演示快照</span>;
