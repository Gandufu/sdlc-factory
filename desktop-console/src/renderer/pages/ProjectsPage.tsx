import { FixtureBadge } from '../components/AppShell';
import { projectSnapshots } from '../data/fixtures';

const stateLabels = { running: '执行中', review: '等待裁决', blocked: '需介入' };

export const ProjectsPage = ({ onOpen }: { onOpen: (projectId: string) => void }) => (
  <main className="page projects-page">
    <header className="page-heading">
      <div><FixtureBadge /><h1>把交付事实放在一条线上。</h1><p>从项目进入连续工作区；跨项目只显示容量、裁决和异常。</p></div>
      <button className="primary-button" disabled title="项目创建接口将在 M1 提供">＋ 创建项目</button>
    </header>
    <section className="project-summary" aria-label="项目摘要">
      <div><span>活跃项目</span><strong>{projectSnapshots.length}</strong></div>
      <div><span>等待裁决</span><strong>01</strong></div>
      <div><span>需要介入</span><strong>01</strong></div>
      <p>项目查询合同尚未提供，当前内容来自可替换的 fixture adapter。</p>
    </section>
    <div className="section-heading"><div><span>PROJECT CATALOG</span><h2>最近项目</h2></div><button>全部项目⌄</button></div>
    <section className="project-list">
      {projectSnapshots.map((project) => (
        <button className="project-row" key={project.id} onClick={() => onOpen(project.id)}>
          <span className={`project-avatar ${project.state}`}>{project.initials}</span>
          <span className="project-identity"><strong>{project.name}</strong><small>{project.id} · {project.template}</small></span>
          <span className="project-stage"><small>当前阶段</small><strong>{project.stage}</strong></span>
          <span className="project-progress"><i><b style={{ width: `${project.progress}%` }} /></i><small>{project.progress}% · {project.updated}</small></span>
          <span className={`state-chip ${project.state}`}><i />{stateLabels[project.state]}</span>
          <span className="row-arrow">→</span>
        </button>
      ))}
    </section>
  </main>
);
