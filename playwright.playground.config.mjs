import { defineConfig } from '@playwright/test';
import website from './playwright.config.mjs';

export default defineConfig({
  testDir: './tests/playground',
  timeout: 90000,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: '.cache/playground-report', open: 'never' }]],
  outputDir: '.cache/playground-results',
  use: { baseURL: 'http://127.0.0.1:8788', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: website.projects.map((project) => ({
    ...project,
    testMatch: project.name.includes('desktop') ? '*.spec.mjs' : 'editor.spec.mjs',
    use: {
      ...project.use,
      ...(project.use.browserName === 'chromium'
        ? { launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } }
        : {}),
    },
  })),
  webServer: website.webServer,
});
