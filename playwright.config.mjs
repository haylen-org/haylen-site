import { defineConfig } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const firefoxLaunchOptions = {};
if (process.platform === 'darwin') {
  const appData = fileURLToPath(new URL('./.cache/firefox/app/', import.meta.url));
  const localData = fileURLToPath(new URL('./.cache/firefox/local/', import.meta.url));
  await Promise.all([mkdir(appData, { recursive: true }), mkdir(localData, { recursive: true })]);
  firefoxLaunchOptions.env = { ...process.env, MOZ_APP_DATA: appData, MOZ_LOCAL_APP_DATA: localData };
}

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'site.spec.mjs',
  timeout: 30000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { outputFolder: '.cache/browser-report', open: 'never' }]],
  outputDir: '.cache/browser-results',
  use: { baseURL: 'http://127.0.0.1:8788', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    {
      name: 'firefox-desktop',
      use: {
        browserName: 'firefox',
        viewport: { width: 1440, height: 1000 },
        launchOptions: firefoxLaunchOptions,
      },
    },
    { name: 'webkit-desktop', use: { browserName: 'webkit', viewport: { width: 1440, height: 1000 } } },
    {
      name: 'chromium-tablet',
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: 'chromium-mobile',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'webkit-mobile',
      use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run preview -- --ip 127.0.0.1 --port 8788 --compatibility-date 2026-11-13',
    url: 'http://127.0.0.1:8788',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
