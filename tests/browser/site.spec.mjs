import { test, expect } from '@playwright/test';

// Keep browser checks to opening the public pages. Do not run example projects.
for (const [name, url] of [
  ['Home', '/'],
  ['About', '/about/'],
  ['Demos', '/demos/'],
  ['Playground', '/playground/'],
]) {
  test(name + ' opens', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(url);
    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (url === '/playground/') {
      await expect(page.locator('#save-status')).toContainText(/Saved|Restored/);
    }
    expect(errors).toEqual([]);
  });
}
