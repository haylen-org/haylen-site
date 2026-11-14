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
        separated: (() => {
          const scene = visual.querySelector('.visual-scene').getBoundingClientRect();
          const languages = visual.querySelector('.visual-languages').getBoundingClientRect();
          const actions = document.querySelector('.hero-actions').getBoundingClientRect();
          const overlapsActions =
            Math.min(scene.right, actions.right) > Math.max(scene.left, actions.left) &&
            Math.min(scene.bottom, actions.bottom) > Math.max(scene.top, actions.top);
          return scene.bottom < languages.top && !overlapsActions;
        })(),
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
    expect(result, `Hero at ${width}px`).toEqual({ overflow: 'visible', contained: true, separated: true });
  }
});

test('cyan trail stays behind its particle in the direction of travel', async ({ page }) => {
  await page.goto('/');
  const geometry = await page.locator('.orbit-trail-cyan').evaluate((trail) => {
    const start = trail.getPointAtLength(0);
    const end = trail.getPointAtLength(trail.getTotalLength());
    const particle = document.querySelector('.orbit-particle-cyan');
    const head = { x: particle.cx.baseVal.value, y: particle.cy.baseVal.value };
    const angle = (point) => (Math.atan2(point.y - 210, point.x - 220) * 180) / Math.PI;
    return {
      gap: Math.hypot(end.x - head.x, end.y - head.y),
      trailingAngle: (angle(head) - angle(start) + 360) % 360,
      direction: getComputedStyle(trail.parentElement).animationDirection,
    };
  });
  expect(geometry.gap).toBeLessThan(0.1);
  expect(geometry.trailingAngle).toBeGreaterThan(20);
  expect(geometry.trailingAngle).toBeLessThan(40);
  expect(geometry.direction).toBe('normal');
});

test('hero motion runs, pauses, resumes and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const visual = page.locator('.engine-visual');
  await visual.scrollIntoViewIfNeeded();
  const orbit = page.locator('.orbit-track-inner');
  const transform = () => orbit.evaluate((element) => getComputedStyle(element).transform);
  const haloTransforms = () =>
    page
      .locator('.visual-halo')
      .evaluateAll((halos) => halos.map((halo) => getComputedStyle(halo).transform));
  const initialHalos = await haloTransforms();
  const initial = await transform();
  await expect.poll(transform).not.toBe(initial);
  await expect
    .poll(async () => (await haloTransforms()).every((value, index) => value !== initialHalos[index]))
    .toBe(true);
  await page.getByRole('button', { name: 'Pause animation' }).click();
  await expect(visual).toHaveAttribute('data-motion', 'paused');
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const paused = await transform();
  const pausedHalos = await haloTransforms();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  expect(await transform()).toBe(paused);
  expect(await haloTransforms()).toEqual(pausedHalos);
  await page.getByRole('button', { name: 'Play animation' }).focus();
  await page.keyboard.press('Enter');
  await expect(visual).toHaveAttribute('data-motion', 'running');
  await expect.poll(transform).not.toBe(paused);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(visual).toHaveAttribute('data-motion', 'paused');
  await expect(page.locator('.motion-toggle')).toBeHidden();
  expect(await orbit.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  expect(
    await page
      .locator('.visual-halo')
      .evaluateAll((halos) => halos.every((halo) => getComputedStyle(halo).animationName === 'none')),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: 'Pause animation' })).toBeVisible();
  await page.locator('#features').scrollIntoViewIfNeeded();
  await expect(visual).toHaveAttribute('data-motion-visible', 'false');
  expect(await orbit.evaluate((element) => getComputedStyle(element).animationPlayState)).toBe('paused');
});

test('hero stays visible and still without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.locator('.visual-logo')).toBeVisible();
  await expect(page.locator('.motion-toggle')).toBeHidden();
  expect(
    await page.locator('.visual-logo').evaluate((element) => getComputedStyle(element).animationPlayState),
  ).toBe('paused');
  await context.close();
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
  ]);
  for (const url of urls) expect((await request.get(new URL(url).pathname)).status()).toBe(200);
  const missing = await request.get('/not-a-page');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain('content="noindex, follow"');
});
