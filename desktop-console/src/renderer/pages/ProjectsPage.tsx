import { useState, type FormEvent } from 'react';
import type { CreateProjectInput, ProjectSummary } from '../api/types';

const stateLabel = (state: string) => ({
  APPROVED: '初始化已批准', AWAITING_REVIEW: '等待初始化审核', FAILED: '初始化失败',
}[state] ?? state);

export const ProjectsPage = ({ projects, loading, error, onOpen, onCreate }: {
  projects: ProjectSummary[];
  loading: boolean;
  error?: string;
  onOpen: (project: ProjectSummary) => void;
  onCreate: (input: CreateProjectInput) => Promise<ProjectSummary>;
}) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [directory, setDirectory] = useState('');
  const [submitError, setSubmitError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(undefined);
    try {
      const project = await onCreate({ project_name: name, directory_name: directory,
        template_id: 'TPL-NODE-BASIC', template_version: '1.0.0' });
      setCreating(false); onOpen(project);
    } catch (cause) { setSubmitError(cause instanceof Error ? cause.message : '项目初始化失败'); }
  };

  return <main className="page projects-page">
    <header className="page-heading">
      <div><span className="live-badge">PostgreSQL 实时数据</span><h1>把交付事实放在一条线上。</h1><p>创建项目会真实执行模板生成、Git、测试和运行时校验。</p></div>
      <button className="primary-button" onClick={() => setCreating((value) => !value)}>＋ 创建项目</button>
    </header>
    {creating && <form className="create-project-form" onSubmit={submit}>
      <label>项目名称<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>目录名<input required pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}" value={directory} onChange={(event) => setDirectory(event.target.value)} /></label>
      <span>模板：TPL-NODE-BASIC@1.0.0</span><button className="primary-button">执行初始化</button>
      {submitError && <p>{submitError}</p>}
    </form>}
    <section className="project-summary"><div><span>项目总数</span><strong>{projects.length}</strong></div>
      <div><span>等待审核</span><strong>{projects.filter((p) => p.state === 'AWAITING_REVIEW').length}</strong></div>
      <div><span>已批准</span><strong>{projects.filter((p) => p.state === 'APPROVED').length}</strong></div>
      <p>Project、TemplateBinding 和初始化状态均来自控制平面。</p></section>
    <div className="section-heading"><div><span>PROJECT CATALOG</span><h2>真实项目</h2></div></div>
    {loading && <p>正在加载项目目录…</p>}{error && <p className="data-note">{error}</p>}
    <section className="project-list">{projects.map((project) => <button className="project-row" data-testid={`project-${project.project_id}`} key={project.project_id} onClick={() => onOpen(project)}>
      <span className="project-avatar">{project.name.slice(0, 1)}</span>
      <span className="project-identity"><strong>{project.name}</strong><small>{project.project_id}</small></span>
      <span className="project-stage"><small>模板</small><strong>{project.template_id}@{project.template_version}</strong></span>
      <span className="project-progress"><small>{project.workspace_path}</small></span>
      <span className={`state-chip ${project.state === 'FAILED' ? 'blocked' : project.state === 'APPROVED' ? 'running' : 'review'}`}><i />{stateLabel(project.state)}</span>
      <span className="row-arrow">→</span>
    </button>)}</section>
  </main>;
};
