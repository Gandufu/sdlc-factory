import { useState } from 'react';
import { AppShell, type View } from './components/AppShell';
import { useControlPlane } from './hooks/useControlPlane';
import { useProjects } from './hooks/useProjects';
import type { ProjectSummary } from './api/types';
import { AttentionPage } from './pages/AttentionPage';
import { OperationsPage } from './pages/OperationsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { InitializationPage } from './pages/InitializationPage';

/**
 * Renderer 只组合页面和读取投影，不拥有 Run、Gate 或 Baseline 事实。
 * 当前用本地状态表达导航，避免在 M0 引入尚无深链接需求的路由依赖。
 */
export const App = () => {
  const [view, setView] = useState<View>('projects');
  const [projectId, setProjectId] = useState('PRJ-024');
  const [selectedProject, setSelectedProject] = useState<ProjectSummary>();
  const controlPlane = useControlPlane();
  const projectCatalog = useProjects();

  const openProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setView('workspace');
  };

  const openInitialization = async (project: ProjectSummary) => {
    setSelectedProject(project);
    setView('initialization');
    setSelectedProject(await projectCatalog.get(project.project_id));
  };

  const approveInitialization = async (nextProjectId: string) => {
    const project = await projectCatalog.approve(nextProjectId);
    setSelectedProject(project);
    return project;
  };

  return (
    <AppShell view={view} status={controlPlane.status} capacity={controlPlane.board}
      onNavigate={setView} onRefresh={controlPlane.refresh}>
      {view === 'projects' && <ProjectsPage {...projectCatalog} onOpen={openInitialization} onCreate={projectCatalog.create} />}
      {view === 'attention' && <AttentionPage onOpen={openProject} />}
      {view === 'operations' && <OperationsPage {...controlPlane} onRefresh={controlPlane.refresh} />}
      {view === 'workspace' && <WorkspacePage projectId={projectId} onBack={() => setView('projects')} />}
      {view === 'initialization' && selectedProject && <InitializationPage project={selectedProject}
        onBack={() => setView('projects')} onApprove={approveInitialization} />}
    </AppShell>
  );
};
