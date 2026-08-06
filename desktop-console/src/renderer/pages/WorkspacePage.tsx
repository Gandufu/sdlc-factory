import { FixtureBadge } from '../components/AppShell';
import { lifecycleStages, projectSnapshots } from '../data/fixtures';

export const WorkspacePage = ({ projectId, onBack }: { projectId: string; onBack: () => void }) => {
  // M0 仅验证信息架构；所有裁决按钮保持禁用，避免样例快照被误认为权威事实。
  const project = projectSnapshots.find((item) => item.id === projectId) ?? projectSnapshots[0];
  const activeIndex = project.state === 'review' ? 2 : project.state === 'running' ? 3 : 4;

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <button className="back-button" onClick={onBack}>← 项目</button>
        <div><FixtureBadge /><h1>{project.name}</h1><p>{project.id} · {project.template}</p></div>
        <span className={`state-chip ${project.state}`}><i />{project.stage}</span>
      </header>
      <section className="lifecycle-rail" aria-label="项目生命周期">
        <span className="rail-line" />
        {lifecycleStages.map((stage, index) => (
          <div key={stage} className={index < activeIndex ? 'complete' : index === activeIndex ? 'current' : ''}>
            <i>{index < activeIndex ? '✓' : index + 1}</i><span>{stage}</span>
          </div>
        ))}
      </section>
      <div className="workspace-grid">
        <section className="focus-panel">
          <header><div><span className="panel-kicker">NEXT OPERATOR DECISION</span><h2>总体设计等待裁决</h2></div><span className="waiting-time">已等待 12 分钟</span></header>
          <p className="focus-copy">候选设计已完成确定性检查。批准后形成不可变 DesignBaseline，并解锁能力单元编码。</p>
          <div className="review-facts">
            <div><small>候选产物</small><strong>总体设计 v3</strong><span>sha256: 8f3a…c219</span></div>
            <div><small>确定性检查</small><strong>8 / 8 通过</strong><span>无跳过项</span></div>
            <div><small>证据引用</small><strong>12 项</strong><span>均已绑定 Operation</span></div>
          </div>
          <nav className="review-tabs" aria-label="审核材料"><button className="active">变更摘要</button><button>产物</button><button>证据</button><button>运行记录</button></nav>
          <article className="change-summary"><h3>本次变更</h3><ul><li>冻结 3 个能力单元及其职责边界</li><li>补充认证接口的失败语义与版本策略</li><li>明确 CodeBaseline 与 TestBaseline 的失效传播</li></ul><p>当前材料来自 M0 fixture adapter，不可提交正式 Gate 命令。</p></article>
          <footer><button disabled>要求修改</button><button disabled>挂起澄清</button><button className="primary-button" disabled>批准并形成基线</button></footer>
        </section>
        <aside className="context-panel">
          <section><span className="panel-kicker">DELIVERY STATE</span><h2>交付状态</h2><dl><div><dt>活动 Run</dt><dd>无</dd></div><div><dt>有效基线</dt><dd>RequirementBaseline v2</dd></div><div><dt>阻塞项</dt><dd>0</dd></div></dl></section>
          <section><span className="panel-kicker">DATA COVERAGE</span><h2>M0 数据边界</h2><p>后端尚未提供 Project、Attention 和 Gate Review 查询接口。本页只验证信息架构，不伪造服务端事实。</p></section>
        </aside>
      </div>
    </main>
  );
};
