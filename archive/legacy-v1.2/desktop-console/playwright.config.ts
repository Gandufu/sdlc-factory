import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  outputDir: './target/playwright',
  reporter: 'list',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
