import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function start(page) {
  await page.goto('/playground/');
  await expect(page.locator('#save-status')).toContainText('Saved');
  const available = await page.locator('.playground').getAttribute('data-runtime');
  test.skip(
    available !== 'available' && process.env.HAYLEN_REQUIRE_PLAYGROUND_RUNTIME !== '1',
    'This website-only build has no native player.',
  );
  expect(available).toBe('available');
  await page.locator('#play').click();
  await expect(page.locator('#runtime-state')).toHaveText('Running', { timeout: 60000 });
  await expect(page.locator('#game-hint')).toContainText('FPS', { timeout: 15000 });
  return page.frameLocator('#game-frame');
}
async function lua(page, expression) {
  return page
    .locator('#game-frame')
    .contentFrame()
    .locator('canvas')
    .evaluate((_, text) => window.Module.haylen.console('lua ' + text), expression);
}
test('real game input, pause, hot reload, Lua error recovery and stop/run', async ({ page }, info) => {
  const errors = [];
  const failed = [];
  page.on('pageerror', (e) => errors.push(e.stack));
  page.on('requestfailed', (r) => failed.push(r.url()));
  const frame = await start(page);
  await expect(page.locator('#console')).toContainText('Welcome to Skybound!');
  const initial = await lua(page, "return require('haylen.scene').top().player.x");
  expect(initial.ok).toBe(true);
  await frame.locator('canvas').focus();
  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => Number((await lua(page, "return require('haylen.scene').top().player.x")).output))
    .toBeGreaterThan(Number(initial.output) + 20);
  await page.keyboard.up('ArrowRight');
  await expect
    .poll(async () => (await lua(page, "return require('haylen.scene').top().player.grounded")).output)
    .toBe('true');
  const ground = Number((await lua(page, "return require('haylen.scene').top().player.y")).output);
  await page.getByRole('button', { name: 'Jump ↑', exact: true }).click();
  await expect
    .poll(async () => Number((await lua(page, "return require('haylen.scene').top().player.y")).output), {
      intervals: [20, 40, 80],
    })
    .toBeLessThan(ground - 20);
  await page.locator('#pause').click();
  await expect(page.locator('#runtime-state')).toHaveText('Paused');
  expect(
    await page
      .locator('#game-frame')
      .contentFrame()
      .locator('canvas')
      .evaluate(() => window.Module.haylen.paused()),
  ).toBe(true);
  await page.locator('#pause').click();
  await expect(page.locator('#runtime-state')).toHaveText('Running');
  // Change the visible code through CodeMirror, not the native API.
  const content = (await page.locator('.cm-content').innerText()).replace(
    'Player.speed = 270',
    'Player.speed = 415',
  );
  await page.locator('.cm-content').fill(content);
  await expect.poll(async () => (await lua(page, "return require('player').speed")).output).toBe('415');
  await expect(page.locator('#console')).toContainText('Hot reload');
  await page.locator('.cm-content').fill('local broken = }');
  await expect(page.locator('#runtime-state')).toHaveText('Lua error');
  await page.getByRole('button', { name: 'Playground help' }).click();
  await page.keyboard.press('Escape');
  await page.locator('.cm-content').fill(content);
  await expect(page.locator('#runtime-state')).toHaveText('Running', { timeout: 15000 });
  expect((await lua(page, "return require('player').speed")).output).toBe('415');
  await page.locator('#stop').click();
  await expect(page.locator('#runtime-state')).toHaveText('Stopped');
  await page.locator('#play').click();
  await expect(page.locator('#runtime-state')).toHaveText('Running');
  await page.screenshot({ path: info.outputPath('playing.png'), fullPage: true });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('cached editor and real WebAssembly game restart without a network connection', async ({
  page,
  context,
}) => {
  await start(page);
  await expect(page.locator('#offline-status')).toHaveText('Ready offline', { timeout: 60000 });
  await expect(page.locator('#save-status')).toContainText('Saved');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#save-status')).toContainText('Restored');
  await page.locator('#play').click();
  await expect(page.locator('#runtime-state')).toHaveText('Running', { timeout: 60000 });
  await expect(page.locator('#game-hint')).toContainText('FPS');
  const proof = await lua(page, "return require('player').speed");
  expect(proof).toEqual({ ok: true, output: '270' });
  await context.setOffline(false);
});

test('local binary import, rename and delete reach the real package; main edits restart safely', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  await page.locator('[data-path="content"]').click();
  await page.locator('#file-import').setInputFiles({
    name: 'imported.png',
    mimeType: 'image/png',
    buffer: await readFile('src/public/assets/og-cover.png'),
  });
  await expect(page.locator('#active-file')).toHaveText('content/imported.png');
  await expect
    .poll(async () => (await lua(page, "return require('haylen.assets').exists('imported.png')")).output)
    .toBe('true');
  expect(
    await lua(
      page,
      "local image = require('haylen.assets').texture('imported.png'); return image.width, image.height",
    ),
  ).toEqual({ ok: true, output: '1200  630' });
  await page.locator('#rename-item').click();
  await page.getByLabel('Project path').fill('content/moved.png');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await lua(
            page,
            "return require('haylen.assets').exists('moved.png'), require('haylen.assets').exists('imported.png')",
          )
        ).output,
    )
    .toBe('true  false');
  await page.locator('#delete-item').click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect
    .poll(async () => (await lua(page, "return require('haylen.assets').exists('moved.png')")).output)
    .toBe('false');
  await page.locator('[data-path="source/main.lua"]').click();
  const oldFrame = await page.locator('#game-frame').getAttribute('src');
  const main = await page.locator('.cm-content').innerText();
  await page.locator('.cm-content').fill(main + '\nprint("New main loaded")');
  await expect(page.locator('#console')).toContainText('New main loaded', { timeout: 15000 });
  expect(await page.locator('#game-frame').getAttribute('src')).not.toBe(oldFrame);
  await expect(page.locator('#runtime-state')).toHaveText('Running');
  expect(errors).toEqual([]);
});
