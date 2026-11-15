import { defineConfig } from '@playwright/test';
import website from './playwright.config.mjs';

export default defineConfig({
  testDir: './tests/playground',
  testMatch: 'editor.spec.mjs',
  timeout: 30000,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: '.cache/playground-report', open: 'never' }]],
  outputDir: '.cache/playground-results',
  use: { baseURL: 'http://127.0.0.1:8788', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: website.projects,
  webServer: website.webServer,
});
