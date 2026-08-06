import { AlertTriangle, Clock3, RefreshCw, ShieldAlert } from 'lucide-react';
import type { AttentionItem } from '@/api/types';
import type { ControlPlaneStatus } from '../../shared/contracts';
import { Button } from '@/components/ui/button';

export const AttentionPage = ({ status, items, error, onRefresh, onOpen }: {
  status: ControlPlaneStatus;
  items: AttentionItem[];
  error?: string;
  onRefresh: () => void;
  onOpen: (item: AttentionItem) => void;
}) => (
  <main className="page">
    <header className="page-heading compact">
      <div><span className="live-badge"><i />权威待处理投影</span><h1>待处理</h1><p>只有需要裁决、恢复或明确介入的事项进入这里。</p></div>
      <Button variant="outline" onClick={onRefresh}><RefreshCw aria-hidden="true" />刷新</Button>
    </header>
    {status.state !== 'ready' && !items.length ? <section className="empty-state error-state"><AlertTriangle /><h2>控制平面尚未就绪</h2><p>{status.detail}</p></section>
      : error && !items.length ? <section className="empty-state error-state"><ShieldAlert /><h2>待处理投影加载失败</h2><p>{error}</p></section>
      : items.length ? <section className="attention-list">
        {items.map((item) => {
          const decision = item.category === 'REVIEW';
          return <button key={item.attention_id} onClick={() => onOpen(item)}>
            <span className={`attention-signal ${decision ? 'decision' : 'blocked'}`}>{decision ? <Clock3 /> : <ShieldAlert />}</span>
            <span><small>{item.scope}</small><strong>{item.title}</strong><p>{item.summary}</p></span>
            <em>{decision ? '等待裁决' : item.category === 'BLOCKED' ? '已阻塞' : '需要人工介入'}</em><b>→</b>
          </button>;
        })}
      </section> : <section className="empty-state"><span>✓</span><h2>当前没有待处理事项</h2><p>控制平面没有返回等待裁决、阻塞或人工介入事实。</p></section>}
    {items.length > 0 && status.state !== 'ready' && <p className="stale-projection">控制平面已断开，当前显示上一次成功读取的非实时投影。</p>}
  </main>
);
