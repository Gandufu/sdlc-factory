import path from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import type { ProjectSummary } from '../src/renderer/api/types';

const controlPlaneOrigin = 'http://127.0.0.1:8420';

const loadPersistedProject = async (): Promise<{ project: ProjectSummary; sessionTitle: string }> => {
  const requestedId = process.env.SDLC_FACTORY_E2E_PROJECT_ID;
  const response = await fetch(`${controlPlaneOrigin}/api/projects`);
  if (!response.ok) throw new Error(`控制平面项目查询失败：HTTP ${response.status}`);
  const projects = await response.json() as ProjectSummary[];
  const project = requestedId ? projects.find((candidate) => candidate.project_id === requestedId)
    : projects.find((candidate) => candidate.state === 'APPROVED');
  if (!project) throw new Error('没有可用于 E2E 的持久化项目，请先完成一次真实项目初始化');
  const workspaceResponse = await fetch(`${controlPlaneOrigin}/api/projects/${project.project_id}/workspace`);
  if (!workspaceResponse.ok) throw new Error(`项目工作区查询失败：HTTP ${workspaceResponse.status}`);
  const workspace = await workspaceResponse.json() as { sessions: Array<{ title: string }> };
  let sessionTitle = workspace.sessions[0]?.title;
  if (!sessionTitle) {
    const createResponse = await fetch(`${controlPlaneOrigin}/api/projects/${project.project_id}/sessions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'opencode-luna-max', title: 'Electron E2E 会话' }),
    });
    if (!createResponse.ok) throw new Error(`E2E 会话创建失败：HTTP ${createResponse.status}`);
    sessionTitle = ((await createResponse.json()) as { title: string }).title;
  }
  return { project, sessionTitle };
};

test('Electron 从真实控制平面加载持久化项目目录', async () => {
  const { project, sessionTitle } = await loadPersistedProject();
  const executablePath = path.join(process.cwd(), 'out', 'SDLC Factory-win32-x64', 'sdlc-factory.exe');
  let application: ElectronApplication | undefined;
  const rendererErrors: string[] = [];

  try {
    application = await electron.launch({ executablePath, cwd: path.dirname(executablePath) });
    const window = await application.firstWindow();
    await window.setViewportSize({ width: 1024, height: 720 });
    await window.emulateMedia({ reducedMotion: 'reduce' });
    window.on('console', (message) => { if (message.type() === 'error') rendererErrors.push(message.text()); });
    window.on('pageerror', (error) => rendererErrors.push(error.message));

    await expect(window).toHaveTitle('SDLC Factory');
    await expect(window.getByText('本地控制平面', { exact: true })).toBeAttached();
    await expect(window.getByTestId('control-plane-health')).toContainText('已就绪');

    await expect(window.getByTestId(`project-${project.project_id}`)).toBeVisible();
    await expect(window.getByText(project.name, { exact: true })).toBeVisible();
    await window.getByTestId(`project-${project.project_id}`).click();
    await expect(window.getByText('权威项目工作区', { exact: true })).toBeVisible();
    await expect(window.getByRole('heading', { name: sessionTitle, exact: true })).toBeVisible();
    await expect(window.getByText('初始化', { exact: true })).toBeVisible();
    const viewport = await window.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
    expect(viewport.reducedMotion).toBe(true);

    await window.locator('body').click({ position: { x: 1000, y: 700 } });
    await window.keyboard.press('Tab');
    expect(await window.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
    expect(rendererErrors).toEqual([]);
  } finally {
    await application?.close();
  }
});
