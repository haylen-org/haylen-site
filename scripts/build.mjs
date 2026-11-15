import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIconTokens } from './icons.mjs';
import { pageSeo, sitemap, validateSite } from './seo.mjs';
import { buildPlayground, buildOfflineCache } from './playground.mjs';
import {
  filesUnder,
  maxAssetBytes,
  prepareStaticDemo,
  samplePathPattern,
  verifyDemo,
} from './demo-artifacts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.resolve(root, process.env.HAYLEN_DIST_DIR || 'dist');
const demoSource = path.resolve(root, process.env.HAYLEN_WEB_DEMOS_DIR || '.cache/web-demos');
const readText = (name) => readFile(path.join(root, name), 'utf8');
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );
function replaceTokens(template, tokens) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, name) => {
    if (!(name in tokens)) throw new Error(`Missing template variable: ${name}`);
    return String(tokens[name]);
  });
}

function validateSamples(samples) {
  if (!Array.isArray(samples) || !samples.length) throw new Error('Expected a nonempty sample catalogue');
  const seen = new Set();
  for (const sample of samples) {
    if (!samplePathPattern.test(sample.path) || seen.has(sample.path))
      throw new Error(`Invalid or duplicate sample: ${sample.path}`);
    if (!['Games', 'Apps', 'Stress', 'Tests', 'C++'].includes(sample.category))
      throw new Error(`Invalid category: ${sample.category}`);
    if (!/^[a-z0-9-]+$/.test(sample.cover)) throw new Error(`Invalid cover: ${sample.cover}`);
    if (
      sample.image &&
      (!/^[a-z0-9-]+\.(png|jpg|webp)$/.test(sample.image) ||
        !existsSync(path.join(root, 'src/public/assets/samples', sample.image)))
    )
      throw new Error(`Invalid sample image: ${sample.image}`);
    for (const property of ['name', 'description']) {
      if (typeof sample[property] !== 'string' || !sample[property].trim())
        throw new Error(`Missing ${property} for ${sample.path}`);
    }
    seen.add(sample.path);
  }
}

function navLinks(page, prefix, mobile = false) {
  const links = [
    ['Home', './', 'home'],
    ['About', 'about/', 'about'],
    ['Demos', 'demos/', 'demos'],
    ['Playground', 'playground/', 'playground'],
  ];
  return (
    links
      .map(
        ([label, target, slug]) =>
          `<a class="nav-link" href="${prefix}${target}"${slug === page ? ' aria-current="page"' : ''}>${label}</a>`,
      )
      .join('') + (mobile ? '<a href="https://github.com/haylen-org/haylen">GitHub ↗</a>' : '')
  );
}

function sampleArt(sample, prefix) {
  let graphic;
  const image = sample.image;
  if (image) {
    graphic = `<img class="sample-capture" src="${prefix}assets/samples/${image}" alt="${escapeHtml(sample.name)} running in Haylen WebAssembly" width="1280" height="800" loading="lazy">`;
  } else if (sample.category === 'C++') {
    graphic = '<div class="cpp-cover" aria-hidden="true"><span>C++</span><small>C++ PROJECT</small></div>';
  } else {
    graphic = `<img src="${prefix}favicon.svg" alt="Haylen sample" width="343" height="409" loading="lazy">`;
  }
  return `<div class="sample-art cover-${sample.cover}">${graphic}<span class="sample-category">${escapeHtml(sample.category.toUpperCase())}</span></div>`;
}

function demoLink(sample, manifest, prefix) {
  if (manifest.samples[sample.path]?.available) return `${prefix}web-demos/${sample.path}/index.html`;
  return `https://github.com/haylen-org/haylen/tree/main/samples/${sample.path}`;
}

function card(sample, manifest, icons) {
  const live = manifest.samples[sample.path]?.available === true;
  const lookup = `${sample.name} ${sample.description} ${sample.category}`.toLocaleLowerCase('en-US');
  const run = live
    ? `<a class="play-link" href="${demoLink(sample, manifest, '../')}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(sample.name)} demo in a new tab">Open demo ${icons.ICON_EXTERNAL_LINK}</a>`
    : '<span class="play-placeholder">Web demo not available</span>';
  return `<article class="demo-card${live ? ' is-live' : ''}" data-category="${escapeHtml(sample.category.toLowerCase())}" data-search="${escapeHtml(lookup)}" data-demo="${sample.path}">
    ${sampleArt(sample, '../')}
    <div class="demo-details"><div class="demo-meta"><span>${escapeHtml(sample.category.toUpperCase())}</span><span class="demo-state"><i></i>${live ? 'READY' : 'SOURCE CODE'}</span></div><h3>${escapeHtml(sample.name)}</h3><p>${escapeHtml(sample.description)}</p><div class="demo-actions">${run}<a class="source-link" href="https://github.com/haylen-org/haylen/tree/main/samples/${sample.path}" aria-label="View ${escapeHtml(sample.name)} source code">Source code ${icons.ICON_CODE}</a></div></div>
  </article>`;
}

async function publishDemos(samples) {
  const target = path.join(dist, 'web-demos');
  await mkdir(target, { recursive: true });
  let manifest = { schemaVersion: 1, samples: {} };
  if (existsSync(demoSource)) {
    manifest = JSON.parse(await readFile(path.join(demoSource, 'manifest.json'), 'utf8'));
    if (
      manifest.schemaVersion !== 1 ||
      !manifest.samples ||
      Array.isArray(manifest.samples) ||
      typeof manifest.samples !== 'object'
    )
      throw new Error('Invalid WebAssembly manifest schema');
    const permitted = new Set(samples.map(({ path: slug }) => slug));
    for (const [slug, entry] of Object.entries(manifest.samples)) {
      if (!permitted.has(slug) || !samplePathPattern.test(slug) || entry?.available !== true)
        throw new Error(`Invalid published sample: ${slug}`);
      const directory = path.join(demoSource, slug);
      await verifyDemo(directory);
      await cp(directory, path.join(target, slug), { recursive: true, force: false, errorOnExist: true });
      await prepareStaticDemo(path.join(target, slug));
    }
  }
  if (
    process.env.HAYLEN_REQUIRE_ALL_DEMOS === '1' &&
    samples.some((sample) => !manifest.samples[sample.path]?.available)
  )
    throw new Error('Production requires a successful web build for every sample');
  await writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

async function main() {
  if (dist !== path.join(root, 'dist') && !dist.startsWith(path.join(root, '.cache') + path.sep))
    throw new Error('Build output must be dist/ or a directory inside .cache/');
  const samples = JSON.parse(await readText('src/data/samples.json'));
  validateSamples(samples);
  const layout = await readText('src/layout.html');
  const header = await readText('src/partials/site-header.html');
  const footer = await readText('src/partials/site-footer.html');
  const renderLayout = (values) =>
    replaceTokens(layout, {
      ...values,
      SITE_HEADER: values.PAGE === 'playground' ? '' : replaceTokens(header, values),
      SITE_FOOTER: values.PAGE === 'playground' ? '' : replaceTokens(footer, values),
    });
  const site = validateSite(
    JSON.parse(await readText('src/data/site.json')),
    await readFile(path.join(root, 'src/public/assets/og-cover.png')),
  );
  const icons = await loadIconTokens();
  const pages = [
    [
      'home',
      'index.html',
      'Haylen Engine — Open-source C++ and Lua games & apps',
      'Build games and apps with C++, Lua and native plugins. Haylen is an open-source engine for desktop, mobile, TV and the web.',
      '',
    ],
    [
      'about',
      'about/index.html',
      'About Haylen — C++, Lua and native plugins',
      'Learn how Haylen works: a C++ engine, a Lua API, shared app projects and native plugins for each platform.',
      '../',
    ],
    [
      'demos',
      'demos/index.html',
      'Demos — Play Haylen games and apps in your browser',
      'Try Haylen games, apps and engine tests in your browser. Open each WebAssembly demo in a new tab and read its source code.',
      '../',
    ],
  ];
  pages.push([
    'playground',
    'playground/index.html',
    'Playground — Haylen browser IDE',
    'Edit Lua projects, manage assets and run Haylen in your browser. Import and export project ZIPs, use hot reload and keep working offline.',
    '../',
  ]);
  await rm(dist, { force: true, recursive: true });
  await mkdir(dist, { recursive: true });
  await cp(path.join(root, 'src/public'), dist, { recursive: true });
  await cp(path.join(root, 'node_modules/lucide-static/LICENSE'), path.join(dist, 'licenses/lucide.txt'));
  await cp(
    path.join(root, 'node_modules/@fortawesome/free-brands-svg-icons/LICENSE.txt'),
    path.join(dist, 'licenses/fontawesome.txt'),
  );
  for (const filename of ['_headers', '_redirects'])
    await cp(path.join(root, filename), path.join(dist, filename));
  await writeFile(
    path.join(dist, 'robots.txt'),
    replaceTokens(await readText('robots.txt'), { SITE_URL: site.url }),
  );
  await writeFile(path.join(dist, 'sitemap.xml'), sitemap(site, pages));
  const manifest = await publishDemos(samples);
  const playgroundAvailable = await buildPlayground(root, dist);
  const published = Object.keys(manifest.samples).length;
  const categories = ['all', ...new Set(samples.map((sample) => sample.category.toLowerCase()))];
  const categoryNames = {
    all: 'All projects',
    games: 'Games',
    apps: 'Apps',
    stress: 'Stress',
    tests: 'Tests',
    'c++': 'C++',
  };
  const filters = categories
    .map(
      (category) =>
        `<button class="filter-chip${category === 'all' ? ' is-active' : ''}" data-filter="${category}" aria-pressed="${category === 'all'}">${categoryNames[category]} <span>${category === 'all' ? samples.length : samples.filter((sample) => sample.category.toLowerCase() === category).length}</span></button>`,
    )
    .join('');
  const tokens = {
    ...icons,
    PAGE_ASSETS: '',
    PLAYGROUND_RUNTIME: playgroundAvailable ? 'available' : 'unavailable',
    BUILD_TIME_ISO: new Date().toISOString(),
    SAMPLE_COUNT: samples.length,
    PUBLISHED_COUNT: published,
    CATEGORY_FILTERS: filters,
    DEMO_CARDS: samples.map((sample) => card(sample, manifest, icons)).join('\n'),
    YEAR: new Date().getUTCFullYear(),
    SITE_NAME: escapeHtml(site.name),
    SOCIAL_IMAGE: `${site.url}/${site.socialImage}`,
    SOCIAL_IMAGE_ALT: escapeHtml(site.socialImageAlt),
    SOCIAL_IMAGE_WIDTH: site.imageWidth,
    SOCIAL_IMAGE_HEIGHT: site.imageHeight,
  };
  tokens.BUILD_TIME_UTC = tokens.BUILD_TIME_ISO.replace('T', ' ').replace(/\.[0-9]+Z$/, ' UTC');
  for (const [page, filename, title, description, prefix] of pages) {
    const values = {
      ...tokens,
      PAGE_ASSETS:
        page === 'playground'
          ? '<link rel="stylesheet" href="./editor.css" /><script type="module" src="./editor.js"></script>'
          : '',
      ...pageSeo(site, page, title, description),
      TITLE: escapeHtml(title),
      DESCRIPTION: escapeHtml(description),
      PAGE: page,
      PREFIX: prefix,
      DESKTOP_NAV: navLinks(page, prefix),
      MOBILE_NAV: navLinks(page, prefix, true),
    };
    const body = replaceTokens(await readText(`src/pages/${page}.html`), values);
    const destination = path.join(dist, filename);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, renderLayout({ ...values, BODY: body }));
  }
  const errorBody =
    '<section class="container error-page"><p class="eyebrow">404</p><h1>Page not found.</h1><p>This address does not match a page on the Haylen website.</p><a class="button button-primary" href="/">Go to the home page</a></section>';
  await writeFile(
    path.join(dist, '404.html'),
    renderLayout({
      ...tokens,
      CANONICAL: `${site.url}/404.html`,
      CANONICAL_LINK: '',
      ROBOTS: 'noindex, follow',
      STRUCTURED_DATA: '',
      TITLE: 'Page not found — Haylen',
      DESCRIPTION: 'Return to Haylen.',
      PAGE: '404',
      PREFIX: '/',
      DESKTOP_NAV: navLinks('404', '/'),
      MOBILE_NAV: navLinks('404', '/', true),
      BODY: errorBody,
    }),
  );
  const executable = path.join(
    root,
    'node_modules/.bin',
    process.platform === 'win32' ? 'tailwindcss.cmd' : 'tailwindcss',
  );
  const css = spawnSync(
    executable,
    ['-i', './src/tailwind.css', '-o', path.join(dist, 'assets/site.css'), '--minify'],
    { cwd: root, stdio: 'inherit' },
  );
  if (css.error || css.status !== 0)
    throw new Error(`Tailwind build failed: ${css.error?.message ?? css.status}`);
  await buildOfflineCache(dist, playgroundAvailable);
  let count = 0;
  for await (const file of filesUnder(dist)) {
    if ((await stat(file)).size > maxAssetBytes)
      throw new Error(`Cloudflare Pages 25 MiB asset limit exceeded: ${file}`);
    count++;
  }
  const maxFiles = Number(process.env.CLOUDFLARE_MAX_FILES || 20000);
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 100000)
    throw new Error('CLOUDFLARE_MAX_FILES must be an integer from 1 to 100000 matching your Pages plan');
  if (count > maxFiles) throw new Error(`Cloudflare Pages file limit exceeded: ${count}/${maxFiles}`);
  console.log(
    `Built ${pages.length} pages + 404, ${samples.length} samples, ${published} WASM builds, ${count} files.`,
  );
}

main().catch((error) => {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
});
