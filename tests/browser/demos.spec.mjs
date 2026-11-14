import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const samples = JSON.parse(await readFile(new URL('../../src/data/samples.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(
  await readFile(new URL('../../dist/web-demos/manifest.json', import.meta.url), 'utf8'),
);
const requireAll = process.env.HAYLEN_REQUIRE_ALL_DEMOS === '1';

for (const sample of samples) {
  test(`${sample.name}: opens a new tab and renders the native app`, async ({
    page: catalogue,
    baseURL,
  }, testInfo) => {
    if (!requireAll && !manifest.samples[sample.path]) test.skip(true, 'No native build present locally');
    expect(manifest.samples[sample.path]?.available, 'A native build is required for publication').toBe(true);
    const failures = [];
    const requests = [];
    catalogue.context().once('page', (runtime) => {
      runtime.on('pageerror', (error) => failures.push(error.message));
      runtime.on('console', (message) => {
        if (message.type() === 'error') failures.push(message.text());
      });
      runtime.on('response', (response) => {
        if (response.url().includes('/web-demos/') && response.status() >= 400)
          requests.push(`${response.status()} ${response.url()}`);
      });
    });
    await catalogue.goto('/demos/');
    const link = catalogue.locator(`[data-demo="${sample.path}"] .play-link`);
    await expect(link).toHaveAttribute('href', `../web-demos/${sample.path}/index.html`);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const [page] = await Promise.all([catalogue.waitForEvent('popup'), link.click()]);
    await page.waitForLoadState('domcontentloaded');
    if (sample.path === 'games/taskbar-quest') await page.setViewportSize({ width: 1280, height: 320 });
    await expect(catalogue).toHaveURL(`${baseURL}/demos/`);
    // Cloudflare Pages canonicalizes index.html to its containing directory.
    await expect(page).toHaveURL(`${baseURL}/web-demos/${sample.path}/`);
    expect(await page.evaluate(() => window.opener === null)).toBe(true);
    expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
    const canvas = page.locator('#canvas');
    await expect(canvas).toBeVisible();
    await page.waitForFunction(() => document.getElementById('splash')?.classList.contains('hidden'), null, {
      timeout: 90000,
    });
    await expect.poll(() => canvas.evaluate((element) => element.width > 0 && element.height > 0)).toBe(true);
    await page.evaluate(() => {
      window.__sampleFrames = 0;
      Module.haylen.onStats = (stats) => {
        if (stats.drawCalls > 0 && stats.fps > 0) window.__sampleFrames++;
      };
    });
    await page.waitForFunction(() => window.__sampleFrames >= 2, null, { timeout: 15000 });
    await expect(page.locator('#haylen-accessibility [aria-label="Try again"]')).toHaveCount(0);
    if (sample.category !== 'C++')
      await page.waitForFunction(
        () => document.querySelectorAll('#haylen-accessibility [role]').length > 0,
        null,
        { timeout: 30000 },
      );
    await page.keyboard.press('ArrowRight');
    await page.mouse.click(640, Math.min(400, page.viewportSize().height - 40));
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    await page.screenshot({ path: testInfo.outputPath('runtime.png') });
    expect(requests).toEqual([]);
    expect(failures).toEqual([]);
    await page.close();
    await expect(catalogue.locator('#demo-grid')).toBeVisible();
  });
}
