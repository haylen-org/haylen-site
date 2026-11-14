import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'demos.spec.mjs',
  timeout: 120000,
  workers: 1,
  reporter: 'list',
  outputDir: '.cache/demo-results',
  use: {
    baseURL: 'http://127.0.0.1:8788',
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    screenshot: 'on',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] },
  },
  webServer: {
    command: 'npm run preview -- --ip 127.0.0.1 --port 8788 --compatibility-date 2026-11-13',
    url: 'http://127.0.0.1:8788',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
