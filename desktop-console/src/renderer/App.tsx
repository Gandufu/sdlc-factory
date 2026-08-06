import { useState } from 'react';
import { AppShell, type View } from './components/AppShell';
import { useControlPlane } from './hooks/useControlPlane';
import { AttentionPage } from './pages/AttentionPage';
import { OperationsPage } from './pages/OperationsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { WorkspacePage } from './pages/WorkspacePage';

/**
 * Renderer 只组合页面和读取投影，不拥有 Run、Gate 或 Baseline 事实。
 * 当前用本地状态表达导航，避免在 M0 引入尚无深链接需求的路由依赖。
 */
export const App = () => {
  const [view, setView] = useState<View>('projects');
  const [projectId, setProjectId] = useState('PRJ-024');
  const controlPlane = useControlPlane();

  const openProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setView('workspace');
  };

  return (
    <AppShell view={view} status={controlPlane.status} onNavigate={setView} onRefresh={controlPlane.refresh}>
      {view === 'projects' && <ProjectsPage onOpen={openProject} />}
      {view === 'attention' && <AttentionPage onOpen={openProject} />}
      {view === 'operations' && <OperationsPage {...controlPlane} onRefresh={controlPlane.refresh} />}
      {view === 'workspace' && <WorkspacePage projectId={projectId} onBack={() => setView('projects')} />}
    </AppShell>
  );
};
