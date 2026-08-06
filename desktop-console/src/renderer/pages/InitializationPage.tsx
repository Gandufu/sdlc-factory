import type { ProjectSummary } from '../api/types';

export const InitializationPage = ({ project, onBack, onApprove }: {
  project: ProjectSummary;
  onBack: () => void;
  onApprove: (projectId: string) => Promise<ProjectSummary>;
}) => <main className="page">
  <button className="back-button" onClick={onBack}>← 项目</button>
  <header className="page-heading compact"><div><span className="live-badge">Initialization</span>
    <h1>{project.name}</h1><p>{project.project_id} · {project.template_id}@{project.template_version}</p></div></header>
  <section className="initialization-card"><h2>项目初始化</h2>
    <dl><div><dt>状态</dt><dd>{stateLabel(project.state)}</dd></div><div><dt>工作目录</dt><dd>{project.workspace_path}</dd></div>
      <div><dt>初始 Git revision</dt><dd>{project.initial_git_revision ?? '校验中'}</dd></div>
      <div><dt>模板摘要</dt><dd>{project.template_digest ?? '—'}</dd></div></dl>
    {project.failure_detail && <p>{project.failure_detail}</p>}
    {project.state === 'AWAITING_REVIEW' && <button className="primary-button" onClick={() => void onApprove(project.project_id)}>批准初始化并形成基线</button>}
  </section>
</main>;

const stateLabel = (state: string) => state === 'APPROVED' ? '已批准' : state === 'AWAITING_REVIEW' ? '等待人工审核' : state;
