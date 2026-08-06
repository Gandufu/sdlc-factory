import type { ControlPlaneStatus } from '../../shared/contracts';
import type { CapacityBoard, RunEvent, RunProjection } from '../api/types';
import { RunStatusBadge } from '@/components/status-badges';
import { Button } from '@/components/ui/button';

const lanes: RunProjection['lane'][] = ['READY', 'RUNNING', 'WAITING_FOR_HUMAN', 'BLOCKED', 'COMPLETED'];

export const OperationsPage = ({
  status, board, error, events, runs, streamConnected, onRefresh,
}: {
  status: ControlPlaneStatus;
  board: CapacityBoard | null;
  error?: string;
  events: RunEvent[];
  runs: RunProjection[];
  streamConnected: boolean;
  onRefresh: () => void;
}) => (
  <main className="page">
    <header className="page-heading compact">
      <div><span className="live-badge"><i />真实控制平面</span><h1>运行与容量</h1><p>容量与 Run 状态来自权威投影；事件流仅用于观测。</p></div>
      <Button variant="outline" onClick={onRefresh}>刷新投影</Button>
    </header>
    {status.state !== 'ready' && !board ? (
      <section className="empty-state error-state"><span>×</span><h2>控制平面尚未就绪</h2><p>{status.detail ?? '请先启动 Spring Boot 控制平面。'}</p><button onClick={onRefresh}>重新检查</button></section>
    ) : error && !board ? (
      <section className="empty-state error-state"><span>!</span><h2>运行投影加载失败</h2><p>{error}</p><button onClick={onRefresh}>重试</button></section>
    ) : <>
      {status.state !== 'ready' && <p className="stale-projection">控制平面已断开，以下内容是上一次成功读取的非实时投影。</p>}
      <section className="run-board" aria-label="Run 权威状态列">
        {lanes.map((lane) => {
          const laneRuns = runs.filter((run) => run.lane === lane);
          return <div className="run-lane" key={lane}><header><RunStatusBadge state={lane} /><strong>{laneRuns.length}</strong></header>
            <div>{laneRuns.map((run) => <article key={run.run_id}>
              <small>{run.project_name}</small><strong>{run.run_id}</strong><span>{run.scope}</span><em>权威状态 {run.authoritative_status}</em>
            </article>)}</div>
          </div>;
        })}
      </section>
      <div className="operations-grid">
        <section className="capacity-panel">
          <span className="panel-kicker">EXECUTION CAPACITY</span><h2>唯一活动执行权</h2>
          <strong className="capacity-number">{board?.active_count ?? 0}<small> / {board?.budget.max_concurrent_runs ?? 1}</small></strong>
          <div className="capacity-track"><i style={{ width: board?.active_count ? '100%' : '0%' }} /></div>
          <dl><div><dt>单项目配额</dt><dd>{board?.budget.per_project_quota ?? '—'}</dd></div><div><dt>队列策略</dt><dd>{board?.budget.priority_policy ?? '未提供'}</dd></div></dl>
        </section>
        <section className="queue-panel"><header><div><span className="panel-kicker">WAITING QUEUE</span><h2>容量等待队列</h2></div><strong>{board?.waiting_runs.length ?? 0}</strong></header>
          {board?.waiting_runs.length ? <ol>{board.waiting_runs.map((run) => <li key={run}><span>{run}</span><small>QUEUED_FOR_CAPACITY</small></li>)}</ol> : <p className="quiet-empty">当前没有 Run 等待执行权。</p>}
        </section>
        <section className="events-panel"><header><div><span className="panel-kicker">RUN EVENT STREAM</span><h2>实时观测</h2></div><span className={streamConnected ? 'stream connected' : 'stream'}><i />{streamConnected ? 'SSE 已连接' : 'SSE 已断开'}</span></header>
          {events.length ? <ol>{events.map((event, index) => <li key={`${event.event_id ?? 'event'}-${index}`}><strong>{event.type ?? 'RUN_EVENT'}</strong><span>{event.run_id ?? '未关联 Run'}</span><time>{event.occurred_at ?? '刚刚'}</time></li>)}</ol> : <p className="quiet-empty">SSE 只显示观测事件，不会更改 Run 状态。</p>}
        </section>
      </div>
    </>}
  </main>
);
