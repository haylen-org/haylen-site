import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unpack } from '../../src/playground/archive.mjs';
import { zipSync, strToU8 } from 'fflate';

async function ready(page) {
  await page.goto('/playground/');
  await expect(page.locator('#save-status')).toContainText('Saved');
}
async function files(page) {
  if (await page.locator('#files-panel').isHidden())
    await page.getByRole('button', { name: 'Files', exact: true }).click();
}
async function pathDialog(page, value) {
  await page.getByLabel('Project path').fill(value);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}
test('editor loads without page errors and shows its basic controls', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await expect(page.getByRole('heading', { name: /Playground/ })).toBeVisible();
  await expect(page.locator('.site-header, .site-footer')).toHaveCount(0);
  await expect(page.locator('.cm-content')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Home' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export ZIP' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Playground help' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.screenshot({ path: info.outputPath('editor.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('Back to Home asks for confirmation', async ({ page }) => {
  await ready(page);
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(page.getByRole('heading', { name: 'Leave the playground?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/playground\/$/);
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await page.getByRole('button', { name: 'Back to Home', exact: true }).click();
  await expect(page).toHaveURL(/:\d+\/$/);
});

test('find and replace edits the current file', async ({ page }) => {
  await ready(page);
  await files(page);
  await page.getByRole('button', { name: 'New file', exact: true }).click();
  await pathDialog(page, 'source/search-test.lua');
  await page.locator('.cm-content').fill('local speed = 10\nreturn speed\n');
  await page.locator('.cm-content').press('ControlOrMeta+f');
  const panel = page.getByRole('search', { name: 'Find and replace in this file' });
  await expect(panel).toBeVisible();
  await panel.getByLabel('Find', { exact: true }).fill('speed');
  await panel.getByLabel('Replace', { exact: true }).fill('pace');
  await panel.getByRole('button', { name: 'Replace all matches', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('local pace = 10');
  await expect(page.locator('.cm-content')).toContainText('return pace');
  await panel.getByLabel('Find', { exact: true }).press('Escape');
  await expect(panel).toBeHidden();
});

test('create, move, rename, delete and restore a locally saved file', async ({ page }) => {
  await ready(page);
  await files(page);
  await page.getByRole('button', { name: 'New folder', exact: true }).click();
  await pathDialog(page, 'custom');
  await page.getByRole('button', { name: 'New file', exact: true }).click();
  await pathDialog(page, 'custom/script.lua');
  await expect(page.locator('#active-file')).toHaveText('custom/script.lua');
  const code = '-- My local project\nreturn { speed = 123 }';
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

test('explorer and editor can be hidden; closing an edited file preserves its bytes and closed state', async ({
  page,
}) => {
  await ready(page);
  await files(page);
  await page.getByRole('button', { name: 'Hide file explorer' }).click();
  await expect(page.locator('#files-panel')).toBeHidden();
  await expect(page.locator('#toggle-files')).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  await expect(page.locator('#files-panel')).toBeVisible();
  await page.locator('[data-path="source/main.lua"]').click();
  const source =
    (await readFile('src/public/playground/starter/source/main.lua', 'utf8')) + '\n-- My saved change.\n';
  await page.locator('.cm-content').fill(source);
  await page.getByRole('button', { name: 'Hide code editor' }).click();
  await expect(page.locator('#code-panel')).toBeHidden();
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(page.locator('.cm-content')).toContainText('My saved change.');
  await page.getByRole('button', { name: 'Close file', exact: true }).click();
  await expect(page.locator('#empty-editor')).toBeVisible();
  await expect(page.locator('.cm-editor')).toHaveCount(0);
  await expect(page.locator('#save-status')).toContainText('Saved');
  await page.reload();
  await expect(page.locator('#save-status')).toContainText('Restored');
  await expect(page.locator('#empty-editor')).toBeVisible();
  await files(page);
  await page.locator('[data-path="source/main.lua"]').click();
  await expect(page.locator('.cm-content')).toContainText('My saved change.');
});

test('duplicate paths stay in the dialog and can be corrected without a persistent footer error', async ({
  page,
}) => {
  await ready(page);
  await files(page);
  await page.getByRole('button', { name: 'New file', exact: true }).click();
  await pathDialog(page, 'source/main.lua');
  await expect(page.locator('#action-dialog')).toBeVisible();
  await expect(page.locator('#dialog-error')).toContainText('already in use');
  await expect(page.getByLabel('Project path')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#workspace-notice')).toBeHidden();
  await pathDialog(page, 'source/new-script.lua');
  await expect(page.locator('#action-dialog')).toBeHidden();
  await expect(page.locator('#active-file')).toHaveText('source/new-script.lua');
  await expect(page.locator('#workspace-notice')).toBeHidden();
});

test('importing a new project ZIP replaces old files and folders in the workspace and export', async ({
  page,
}) => {
  await ready(page);
  const archive = zipSync({
    'app.json': strToU8('{"name":"Imported project"}'),
    'source/main.lua': strToU8('print("Imported project")'),
    'content/only-new.txt': strToU8('Only the imported files belong here.'),
  });
  await page
    .locator('#file-import')
    .setInputFiles({ name: 'replacement.zip', mimeType: 'application/zip', buffer: Buffer.from(archive) });
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await expect(page.locator('#project-name')).toHaveText('Imported project');
  await expect(page.locator('[data-path="content/characters"]')).toHaveCount(0);
  await expect(page.locator('[data-path="source/player.lua"]')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ZIP', exact: true }).click();
  const result = await download;
  const project = await unpack(new Uint8Array(await readFile(await result.path())));
  expect([...project.files.keys()].sort()).toEqual(['app.json', 'content/only-new.txt', 'source/main.lua']);
  await expect(page.locator('#save-status')).toContainText('Saved');
  await page.reload();
  await expect(page.locator('#save-status')).toContainText('Restored');
  await expect(page.locator('#project-name')).toHaveText('Imported project');
  await expect(page.locator('[data-path="source/player.lua"]')).toHaveCount(0);
});

test('the console tool opens the preview when needed and can hide only the console', async ({ page }) => {
  await ready(page);
  if (page.viewportSize().width > 1100)
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('#preview-panel')).toBeHidden();
  await expect(page.locator('#toggle-console')).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Console', exact: true }).click();
  await expect(page.locator('#preview-panel')).toBeVisible();
  await expect(page.locator('#console-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Hide console', exact: true }).click();
  await expect(page.locator('#console-panel')).toBeHidden();
  await expect(page.locator('#preview-panel')).toBeVisible();
});
