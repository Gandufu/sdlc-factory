import path from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import type { InitializationOperation, ProjectSummary } from '../src/renderer/api/types';

const controlPlaneOrigin = 'http://127.0.0.1:8420';

type ProjectDetail = ProjectSummary & { operations: InitializationOperation[] };

const loadEvidenceProject = async (): Promise<ProjectDetail> => {
  const requestedId = process.env.SDLC_FACTORY_E2E_PROJECT_ID;
  const response = await fetch(`${controlPlaneOrigin}/api/projects`);
  if (!response.ok) throw new Error(`控制平面项目查询失败：HTTP ${response.status}`);
  const projects = await response.json() as ProjectSummary[];
  const candidates = requestedId ? projects.filter((project) => project.project_id === requestedId) : projects;

  for (const project of candidates) {
    const detailResponse = await fetch(`${controlPlaneOrigin}/api/projects/${project.project_id}`);
    if (!detailResponse.ok) continue;
    const detail = await detailResponse.json() as ProjectDetail;
    const operations = new Set(detail.operations.map((operation) => operation.operation));
    if (detail.state === 'APPROVED' && ['START', 'READINESS', 'STOP'].every((operation) => operations.has(operation))) {
      return detail;
    }
  }
  throw new Error('没有可用于 E2E 的已批准运行证据项目，请先完成一次真实项目初始化');
};

test('从真实项目目录查看完整初始化运行证据', async () => {
  const project = await loadEvidenceProject();
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

    await window.getByTestId(`project-${project.project_id}`).click();
    await expect(window.getByRole('heading', { name: project.name, exact: true })).toBeVisible();
    await expect(window.getByText(project.initial_git_revision!, { exact: true })).toBeVisible();

    for (const operation of ['INSTANTIATE', 'BOOTSTRAP', 'VALIDATE', 'COMPILE', 'BUILD', 'TEST', 'START', 'READINESS', 'STOP']) {
      await expect(window.getByTestId(`initialization-operation-${operation}`)).toBeVisible();
    }
    expect(rendererErrors).toEqual([]);
  } finally {
    await application?.close();
  }
});
