import path from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import type { ProjectSummary } from '../src/renderer/api/types';

const controlPlaneOrigin = 'http://127.0.0.1:8420';

const loadPersistedProject = async (): Promise<ProjectSummary> => {
  const requestedId = process.env.SDLC_FACTORY_E2E_PROJECT_ID;
  const response = await fetch(`${controlPlaneOrigin}/api/projects`);
  if (!response.ok) throw new Error(`控制平面项目查询失败：HTTP ${response.status}`);
  const projects = await response.json() as ProjectSummary[];
  const project = requestedId ? projects.find((candidate) => candidate.project_id === requestedId) : projects[0];
  if (!project) throw new Error('没有可用于 E2E 的持久化项目，请先完成一次真实项目初始化');
  return project;
};

test('Electron 从真实控制平面加载持久化项目目录', async () => {
  const project = await loadPersistedProject();
  const executablePath = path.join(process.cwd(), 'out', 'SDLC Factory-win32-x64', 'sdlc-factory.exe');
  let application: ElectronApplication | undefined;
  const rendererErrors: string[] = [];

  try {
    application = await electron.launch({ executablePath, cwd: path.dirname(executablePath) });
    const window = await application.firstWindow();
    window.on('console', (message) => { if (message.type() === 'error') rendererErrors.push(message.text()); });
    window.on('pageerror', (error) => rendererErrors.push(error.message));

    await expect(window).toHaveTitle('SDLC Factory');
    await expect(window.getByText('本地控制平面', { exact: true })).toBeVisible();
    await expect(window.getByTestId('control-plane-health')).toContainText('已就绪');

    await expect(window.getByTestId(`project-${project.project_id}`)).toBeVisible();
    await expect(window.getByText(project.name, { exact: true })).toBeVisible();
    expect(rendererErrors).toEqual([]);
  } finally {
    await application?.close();
  }
});
