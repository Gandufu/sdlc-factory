import { spawnSync } from 'node:child_process';

export default function globalSetup(): void {
  const packageManager = process.env.npm_execpath;
  if (!packageManager) throw new Error('无法定位 pnpm，请通过 pnpm test:e2e 启动端到端测试');

  const result = spawnSync(process.execPath, [packageManager, 'exec', 'electron-forge', 'package'], {
    cwd: process.cwd(),
    env: { ...process.env, SDLC_FACTORY_E2E: 'true' },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`Electron E2E 测试包生成失败，退出码 ${result.status ?? 'unknown'}`);
}
