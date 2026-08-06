import type { ControlPlaneStatus } from '../../shared/contracts';
import type { CapacityBoard, RunEvent } from '../api/types';

export const OperationsPage = ({
  status, board, error, events, streamConnected, onRefresh,
}: {
  status: ControlPlaneStatus;
  board: CapacityBoard | null;
  error?: string;
  events: RunEvent[];
  streamConnected: boolean;
  onRefresh: () => void;
}) => (
  <main className="page">
    <header className="page-heading compact">
      <div><span className="live-badge"><i />真实控制平面</span><h1>运行与容量</h1><p>容量是权威调度事实；事件流仅用于观测，不推进生命周期。</p></div>
      <button className="secondary-button" onClick={onRefresh}>刷新投影</button>
    </header>
    {status.state !== 'ready' ? (
      <section className="empty-state error-state"><span>×</span><h2>控制平面尚未就绪</h2><p>{status.detail ?? '请先启动 Spring Boot 控制平面。'}</p><button onClick={onRefresh}>重新检查</button></section>
    ) : error ? (
      <section className="empty-state error-state"><span>!</span><h2>容量投影加载失败</h2><p>{error}</p><button onClick={onRefresh}>重试</button></section>
    ) : (
      <div className="operations-grid">
        <section className="capacity-panel">
          <span className="panel-kicker">EXECUTION CAPACITY</span><h2>唯一活动执行权</h2>
          <strong className="capacity-number">{board?.active_count ?? 0}<small> / {board?.budget.max_concurrent_runs ?? 1}</small></strong>
          <div className="capacity-track"><i style={{ width: board?.active_count ? '100%' : '0%' }} /></div>
          <dl><div><dt>单项目配额</dt><dd>{board?.budget.per_project_quota ?? '—'}</dd></div><div><dt>队列策略</dt><dd>依赖 → 业务优先级 → FIFO</dd></div></dl>
        </section>
        <section className="queue-panel"><header><div><span className="panel-kicker">WAITING QUEUE</span><h2>容量等待队列</h2></div><strong>{board?.waiting_runs.length ?? 0}</strong></header>
          {board?.waiting_runs.length ? <ol>{board.waiting_runs.map((run) => <li key={run}><span>{run}</span><small>QUEUED_FOR_CAPACITY</small></li>)}</ol> : <p className="quiet-empty">当前没有 Run 等待执行权。</p>}
        </section>
        <section className="events-panel"><header><div><span className="panel-kicker">RUN EVENT STREAM</span><h2>实时观测</h2></div><span className={streamConnected ? 'stream connected' : 'stream'}><i />{streamConnected ? 'SSE 已连接' : '等待连接'}</span></header>
          {events.length ? <ol>{events.map((event, index) => <li key={`${event.event_id ?? 'event'}-${index}`}><strong>{event.type ?? 'RUN_EVENT'}</strong><span>{event.run_id ?? '未关联 Run'}</span><time>{event.occurred_at ?? '刚刚'}</time></li>)}</ol> : <p className="quiet-empty">连接已建立后，新事件会出现在这里。</p>}
        </section>
      </div>
    )}
  </main>
);
