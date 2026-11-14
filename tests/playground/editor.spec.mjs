import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unpack } from '../../src/playground/archive.mjs';

async function ready(page) {
  await page.goto('/playground/');
  await expect(page.locator('#save-status')).toContainText('Saved');
}
async function files(page) {
  if (page.viewportSize().width <= 600)
    await page.getByRole('button', { name: 'Files', exact: true }).click();
}
async function pathDialog(page, value) {
  await page.getByLabel('Project path').fill(value);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}
test('responsive panels, keyboard help and visible controls', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole('heading', { name: 'Playground PREVIEW' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width <= 1100) await page.getByRole('button', { name: 'Game', exact: true }).click();
    const bounds = await page.locator('#preview').evaluate((element) => {
      const box = element.getBoundingClientRect();
      return [...element.querySelectorAll('button, h2, p, img')]
        .filter((e) => e.getBoundingClientRect().width)
        .every((e) => {
          const b = e.getBoundingClientRect();
          return (
            b.top >= box.top - 1 &&
            b.bottom <= box.bottom + 1 &&
            b.left >= box.left - 1 &&
            b.right <= box.right + 1
          );
        });
    });
    expect(bounds).toBe(true);
    await page.screenshot({ path: info.outputPath(`playground-${width}.png`), fullPage: true });
    if (width <= 1100) await page.getByRole('button', { name: 'Code', exact: true }).click();
    await expect(page.locator('.cm-content')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Playground help' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(errors).toEqual([]);
});

test('create, move, rename, delete and restore a locally saved file', async ({ page }) => {
  await ready(page);
  await files(page);
  await page.getByRole('button', { name: 'New folder', exact: true }).click();
  await pathDialog(page, 'custom');
  await page.getByRole('button', { name: 'New file', exact: true }).click();
  await pathDialog(page, 'custom/cafe\u0301.lua');
  await expect(page.locator('#active-file')).toHaveText('custom/café.lua');
  const code = '-- My local game\nreturn { speed = 123 }';
  await page.locator('.cm-content').fill(code);
  await expect(page.locator('#save-status')).toContainText('Saved');
  await files(page);
  await page.getByRole('button', { name: 'Rename / move', exact: true }).click();
  await pathDialog(page, 'source/moved.lua');
  await expect(page.locator('#active-file')).toHaveText('source/moved.lua');
  await expect(page.locator('#save-status')).toContainText('Saved');
  await page.reload();
  await expect(page.locator('#save-status')).toContainText('Restored');
  await expect(page.locator('#active-file')).toHaveText('source/moved.lua');
  await expect(page.locator('.cm-content')).toContainText('speed = 123');
  await files(page);
  await page.getByRole('button', { name: 'Delete selected item' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('[data-path="source/moved.lua"]')).toHaveCount(0);
});

test('local image import, ZIP export and ZIP project import preserve bytes', async ({ page }) => {
  await ready(page);
  const bytes = await readFile('src/public/assets/og-cover.png');
  // The selected source file imports into source/, as the import UI describes.
  await page
    .locator('#file-import')
    .setInputFiles({ name: 'picture.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.locator('#active-file')).toHaveText('source/picture.png');
  await expect(page.locator('#asset-preview img')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ZIP' }).click();
  const result = await download;
  const archive = new Uint8Array(await readFile(await result.path()));
  const project = await unpack(archive);
  expect(Buffer.from(project.files.get('source/picture.png'))).toEqual(bytes);
  expect(project.files.has('source/main.lua')).toBe(true);
  await page
    .locator('#file-import')
    .setInputFiles({ name: 'project.zip', mimeType: 'application/zip', buffer: Buffer.from(archive) });
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await expect(page.locator('#console')).toContainText('Project imported locally');
  await expect(page.locator('#save-status')).toContainText('Saved');
});
