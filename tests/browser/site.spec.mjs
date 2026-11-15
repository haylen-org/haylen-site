import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const samples = JSON.parse(await readFile(new URL('../../src/data/samples.json', import.meta.url), 'utf8'));

for (const [name, url] of [
  ['Home', '/'],
  ['About', '/about/'],
  ['Demos', '/demos/'],
]) {
  test(`${name}: layout, images and console`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const response = await page.goto(url);
    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator(`.site-header .nav-link[aria-current="page"]`).first()).toHaveText(name);
    for (const image of await page.locator('img').all()) {
      if (!(await image.isVisible())) continue;
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0))
        .toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${name.toLowerCase()}.png`), fullPage: true });
  });
}

test('navigation routes and mobile disclosure', async ({ page }) => {
  await page.goto('/');
  const mobile = page.viewportSize().width <= 600;
  if (mobile) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.locator('#mobile-nav')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-nav')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
    await page.getByRole('button', { name: 'Open navigation' }).click();
  }
  const navigation = page.getByRole('navigation', {
    name: mobile ? 'Mobile navigation' : 'Main navigation',
    exact: true,
  });
  await navigation.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.getByRole('heading', { name: /Built with C\+\+/ })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Footer navigation' })
    .getByRole('link', { name: 'Demos', exact: true })
    .click();
  await expect(page).toHaveURL(/\/demos\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/about\/$/);
});

test('combined category/search, empty state and shareable URL', async ({ page }) => {
  await page.goto('/demos/');
  const cards = page.locator('[data-demo]:visible');
  await expect(cards).toHaveCount(samples.length);
  await page.getByRole('button', { name: /^Games/ }).click();
  await expect(cards).toHaveCount(samples.filter((sample) => sample.category === 'Games').length);
  await page.getByRole('searchbox', { name: 'Search demos' }).fill('tiny');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Tiny Island');
  await expect(page).toHaveURL(/category=games&q=tiny/);
  await page.reload();
  await expect(cards).toHaveCount(1);
  await page.getByRole('searchbox').fill('no-such-project-123');
  await expect(cards).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No demos found.' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(cards).toHaveCount(samples.length);
  await expect(page.getByRole('searchbox')).toBeFocused();
  await expect(page).toHaveURL(/\/demos\/$/);
});

test('keyboard skip link, filtering and focus visibility', async ({ page, browserName }) => {
  await page.goto('/demos/');
  const tabKey = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(tabKey);
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  const filter = page.getByRole('button', { name: /^Apps/ });
  await filter.focus();
  await page.keyboard.press('Enter');
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-demo]:visible')).toHaveCount(
    samples.filter((sample) => sample.category === 'Apps').length,
  );
  expect(await filter.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
});

test('every catalogue link is stable and correct before JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/demos/`);
  await expect(page.locator('[data-demo]')).toHaveCount(samples.length);
  for (const sample of samples) {
    const card = page.locator(`[data-demo="${sample.path}"]`);
    await expect(card.locator('.source-link')).toHaveAttribute(
      'href',
      `https://github.com/haylen-org/haylen/tree/main/samples/${sample.path}`,
    );
    if (await card.locator('.play-link').count())
      await expect(card.locator('.play-link')).toHaveAttribute(
        'href',
        `../web-demos/${sample.path}/index.html`,
      );
  }
  await context.close();
});

test('pages fit a narrow phone viewport', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 900 });
  for (const url of ['/', '/about/', '/demos/']) {
    await page.goto(url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), url).toBe(true);
  }
});

test('missing routes return the branded 404', async ({ page }) => {
  const response = await page.goto('/missing-page');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /Page not found/ })).toBeVisible();
  await page.getByRole('link', { name: /Go to the home page/ }).click();
  await expect(page.getByRole('heading', { name: /Build games/ })).toBeVisible();
});

test('SEO URLs are absolute and search variants share the gallery canonical', async ({ page, request }) => {
  await page.goto('/demos/?category=games&q=tiny');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://haylenengine.com/demos/',
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    'https://haylenengine.com/demos/',
  );
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  const urls = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, 'application/xml');
    if (document.querySelector('parsererror')) throw new Error('Invalid sitemap XML');
    return [...document.querySelectorAll('loc')].map((element) => element.textContent);
  }, xml);
  expect(urls).toEqual([
    'https://haylenengine.com/',
    'https://haylenengine.com/about/',
    'https://haylenengine.com/demos/',
    'https://haylenengine.com/playground/',
  ]);
  for (const url of urls) expect((await request.get(new URL(url).pathname)).status()).toBe(200);
  const missing = await request.get('/not-a-page');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain('content="noindex, follow"');
});
