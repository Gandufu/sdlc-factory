import { useState } from 'react';
import { AppShell, type View } from './components/AppShell';
import { useControlPlane } from './hooks/useControlPlane';
import { useProjects } from './hooks/useProjects';
import type { AttentionItem, InitializationApprovalInput, ProjectSummary } from './api/types';
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

  const openCatalogProject = (project: ProjectSummary) => {
    if (project.state === 'APPROVED') openProject(project.project_id);
    else void openInitialization(project);
  };

  const approveInitialization = async (nextProjectId: string, input: InitializationApprovalInput) => {
    const project = await projectCatalog.approve(nextProjectId, input);
    setSelectedProject(project);
    return project;
  };

  const openAttention = async (item: AttentionItem) => {
    if (item.target_type === 'INITIALIZATION') {
      await openInitialization(await projectCatalog.get(item.project_id));
      return;
    }
    openProject(item.project_id);
  };

  return (
    <AppShell view={view} status={controlPlane.status} capacity={controlPlane.board}
      onNavigate={setView} onRefresh={controlPlane.refresh}>
      {view === 'projects' && <ProjectsPage {...projectCatalog} onRefresh={projectCatalog.refresh}
        onOpen={openCatalogProject} onCreate={projectCatalog.create} />}
      {view === 'attention' && <AttentionPage status={controlPlane.status} items={controlPlane.attention}
        error={controlPlane.error} onRefresh={controlPlane.refresh} onOpen={(item) => void openAttention(item)} />}
      {view === 'operations' && <OperationsPage {...controlPlane} onRefresh={controlPlane.refresh} />}
      {view === 'workspace' && <WorkspacePage projectId={projectId} onBack={() => setView('projects')} />}
      {view === 'initialization' && selectedProject && <InitializationPage project={selectedProject}
        onBack={() => setView('projects')} onApprove={approveInitialization} />}
    </AppShell>
  );
};
