import { FixtureBadge } from '../components/AppShell';
import { attentionSnapshots } from '../data/fixtures';

export const AttentionPage = ({ onOpen }: { onOpen: (projectId: string) => void }) => (
  <main className="page">
    <header className="page-heading compact"><div><FixtureBadge /><h1>待处理</h1><p>只有需要裁决、恢复或明确介入的事项进入这里。</p></div></header>
    <section className="attention-list">
      {attentionSnapshots.map((item) => (
        <button key={item.id} onClick={() => onOpen(item.projectId)}>
          <span className={`attention-signal ${item.severity}`}>{item.severity === 'decision' ? '◇' : '!'}</span>
          <span><small>{item.scope}</small><strong>{item.title}</strong><p>{item.summary}</p></span>
          <em>{item.severity === 'decision' ? '等待裁决' : '已停止自动重试'}</em><b>→</b>
        </button>
      ))}
    </section>
    <p className="data-note">待处理查询合同尚未提供；此页使用独立 M0 快照，不把样例状态写入控制平面。</p>
  </main>
);
