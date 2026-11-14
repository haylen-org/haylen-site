import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const samples = JSON.parse(await readFile(new URL('../../src/data/samples.json', import.meta.url), 'utf8'));

for (const [name, url] of [
  ['Home', '/'],
  ['About', '/about/'],
  ['Web demos', '/demos/'],
]) {
  test(`${name}: layout, images and console`, async ({ page }, testInfo) => {
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
    .getByRole('link', { name: 'Web demos', exact: true })
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

test('320px, landscape and reduced motion remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 600, 820, 1024, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of ['/', '/about/', '/demos/']) {
      await page.goto(url);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${url} at ${width}px`,
      ).toBe(true);
    }
  }
});

test('missing routes return the branded 404', async ({ page }) => {
  const response = await page.goto('/missing-page');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /Page not found/ })).toBeVisible();
  await page.getByRole('link', { name: /Go to the home page/ }).click();
  await expect(page.getByRole('heading', { name: /One engine for/ })).toBeVisible();
});

test('platform table can be scrolled with a keyboard on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/about/');
  const region = page.getByRole('region', { name: 'Platform compatibility table' });
  await region.focus();
  await expect(region).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});

test('home explains features and platforms without sample previews or clipped hero content', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.feature-card')).toHaveCount(6);
  await expect(page.locator('img[src*="assets/samples/"]')).toHaveCount(0);
  await expect(page.locator('.platform-grid .icon')).toHaveCount(10);
  await expect(page.getByRole('heading', { name: 'Native plugins', exact: true })).toBeVisible();
  for (const width of [320, 390, 601, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const result = await page.locator('.engine-visual').evaluate((visual) => {
      const boundary = visual.getBoundingClientRect();
      return {
        overflow: getComputedStyle(visual).overflowX,
        contained: [...visual.querySelectorAll('.visual-logo,.visual-orbits,.language-chip')].every(
          (part) => {
            const r = part.getBoundingClientRect();
            return (
              r.left >= boundary.left - 1 &&
              r.right <= boundary.right + 1 &&
              r.top >= boundary.top - 1 &&
              r.bottom <= boundary.bottom + 1
            );
          },
        ),
      };
    });
    expect(result, `Hero at ${width}px`).toEqual({ overflow: 'visible', contained: true });
  }
});
