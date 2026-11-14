import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filesUnder, verifyDemo } from '../scripts/demo-artifacts.mjs';
import { pageSeo, validateSite } from '../scripts/seo.mjs';
import { desktopContentTool } from '../scripts/build-web-demos.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const text = (name) => readFile(path.join(dist, name), 'utf8');
const catalogue = JSON.parse(await readFile(path.join(root, 'src/data/samples.json'), 'utf8'));
const manifest = JSON.parse(await text('web-demos/manifest.json'));

test('content keys use the upstream desktop artifact layout on Linux, macOS and Windows', async () => {
  await mkdir(path.join(root, '.cache'), { recursive: true });
  const fixture = await mkdtemp(path.join(root, '.cache/content-tool-layout-'));
  try {
    for (const [platform, arch, directory, executable] of [
      ['linux', 'x64', 'linux-x64', 'haylen-content'],
      ['darwin', 'arm64', 'macos-arm64', 'haylen-content'],
      ['win32', 'x64', 'windows-x64', 'haylen-content.exe'],
    ]) {
      const output = path.join(fixture, 'build/artifacts/desktop', directory);
      await mkdir(output, { recursive: true });
      await writeFile(path.join(output, executable), 'Upstream tool output fixture');
      assert.equal(
        await readFile(desktopContentTool(fixture, platform, arch), 'utf8'),
        'Upstream tool output fixture',
      );
    }
    assert.throws(() => desktopContentTool(fixture, 'linux', 'ia32'), /Unsupported host/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('each marketing page has consistent absolute search and social metadata', async () => {
  const image = await readFile(path.join(dist, 'assets/og-cover.png'));
  const titles = new Set();
  const descriptions = new Set();
  for (const [file, route] of [
    ['index.html', '/'],
    ['about/index.html', '/about/'],
    ['demos/index.html', '/demos/'],
    ['playground/index.html', '/playground/'],
  ]) {
    const html = await text(file);
    const canonical = `https://haylenengine.com${route}`;
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}"`));
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}"`));
    assert.match(html, /property="og:image" content="https:\/\/haylenengine\.com\/assets\/og-cover.png"/);
    assert.ok(html.includes(`property="og:image:width" content="${image.readUInt32BE(16)}"`));
    assert.ok(html.includes(`property="og:image:height" content="${image.readUInt32BE(20)}"`));
    assert.match(html, /name="twitter:image:alt" content="[^\"]+"/);
    assert.match(html, /name="robots" content="index, follow, max-image-preview:large"/);
    titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
    descriptions.add(html.match(/name="description" content="([^\"]+)"/)[1]);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])[
      '@graph'
    ];
    assert.equal(graph.find((entry) => entry['@id'] === `${canonical}#webpage`).url, canonical);
    assert.ok(graph.some((entry) => entry['@type'] === 'WebSite'));
    assert.ok(graph.some((entry) => entry['@type'] === 'SoftwareSourceCode'));
  }
  assert.equal(titles.size, 4);
  assert.equal(descriptions.size, 4);
  assert.match(await text('robots.txt'), /Sitemap: https:\/\/haylenengine\.com\/sitemap.xml/);
  assert.doesNotMatch(await text('sitemap.xml'), /404|web-demos|index.html|lastmod/);
  assert.match(await text('404.html'), /name="robots" content="noindex, follow"/);
  assert.match(await text('_headers'), /X-Robots-Tag: noindex, follow/);
});

test('SEO rejects invalid origins and safely serializes structured content', async () => {
  const raw = JSON.parse(await readFile(path.join(root, 'src/data/site.json'), 'utf8'));
  const image = await readFile(path.join(dist, 'assets/og-cover.png'));
  for (const url of [
    'http://haylenengine.com',
    'https://haylenengine.com/path',
    'https://haylenengine.com/?q=x',
    'https://user:pass@haylenengine.com',
  ]) {
    assert.throws(() => validateSite({ ...raw, url }, image), /HTTPS origin/);
  }
  const title = 'Engine & apps </script><script>alert(1)</script>';
  const seo = pageSeo(validateSite(raw, image), 'home', title, 'An engine.');
  assert.equal((seo.STRUCTURED_DATA.match(/<script/g) || []).length, 1);
  const parsed = JSON.parse(seo.STRUCTURED_DATA.match(/>(.*?)<\/script>/s)[1]);
  assert.equal(parsed['@graph'].find((entry) => entry['@type'] === 'WebPage').name, title);
});

for (const [page, filename] of [
  ['home', 'index.html'],
  ['about', 'about/index.html'],
  ['demos', 'demos/index.html'],
  ['playground', 'playground/index.html'],
]) {
  test(`${page}: complete static structure, official branding and metadata`, async () => {
    const html = await text(filename);
    assert.match(html, /<main id="main">/);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description"/);
    assert.match(html, /favicon\.svg/);
    assert.match(html, /<footer class="site-footer">/);
    assert.equal((html.match(/aria-current="page"/g) || []).length, 2);
    assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
  });
}

test('all relative links, images and scripts resolve in the complete static build', async () => {
  for (const file of [
    'index.html',
    'about/index.html',
    'demos/index.html',
    'playground/index.html',
    '404.html',
  ]) {
    const html = await text(file);
    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const address = match[1];
      if (/^(?:https?:|data:|mailto:|#)/.test(address)) continue;
      const clean = address.split(/[?#]/)[0];
      if (!clean) continue;
      let candidate = clean.startsWith('/')
        ? path.join(dist, clean)
        : path.resolve(dist, path.dirname(file), clean);
      assert.ok(candidate.startsWith(`${dist}${path.sep}`) || candidate === dist);
      if (clean.endsWith('/') || candidate === dist) candidate = path.join(candidate, 'index.html');
      assert.ok(existsSync(candidate), `Broken local link ${file} -> ${address}`);
    }
  }
});

test('catalogue uses every unique sample and includes its exact source link', async () => {
  const html = await text('demos/index.html');
  const slugs = [...html.matchAll(/data-demo="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(slugs.length, catalogue.length);
  assert.equal(new Set(slugs).size, catalogue.length);
  for (const sample of catalogue) {
    assert.ok(slugs.includes(sample.path));
    assert.ok(html.includes(`samples/${sample.path}`));
    if (sample.image) assert.ok(existsSync(path.join(dist, 'assets/samples', sample.image)));
  }
});

test('published demos have direct index.html links already rendered before JavaScript', async () => {
  assert.equal(manifest.schemaVersion, 1);
  const html = await text('demos/index.html');
  for (const [slug, record] of Object.entries(manifest.samples)) {
    assert.ok(catalogue.some((sample) => sample.path === slug));
    assert.equal(record.available, true);
    assert.ok(html.includes(`href="../web-demos/${slug}/index.html"`));
    await verifyDemo(path.join(dist, 'web-demos', slug));
  }
  assert.equal((html.match(/class="play-link"/g) || []).length, Object.keys(manifest.samples).length);
  const script = await text('assets/main.js');
  assert.doesNotMatch(script, /fetch\(/);
});

test('all deployment files meet Cloudflare size and file-count limits', async () => {
  let count = 0;
  for await (const file of filesUnder(dist)) {
    assert.ok((await stat(file)).size <= 25 * 1024 * 1024, file);
    count++;
  }
  assert.ok(count <= Number(process.env.CLOUDFLARE_MAX_FILES || 20000));
  const headers = await text('_headers');
  assert.match(headers, /\/web-demos\/\*/);
  assert.match(headers, /Cross-Origin-Opener-Policy: same-origin/);
  assert.match(headers, /Cross-Origin-Embedder-Policy: require-corp/);
});

test('production publishes every sample and the whole dist through one publisher', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/deploy-pages.yml'), 'utf8');
  assert.match(workflow, /HAYLEN_REQUIRE_ALL_DEMOS: '1'/);
  assert.match(workflow, /HAYLEN_REQUIRE_PLAYGROUND_RUNTIME: '1'/);
  assert.match(workflow, /npm run playground:runtime -- --engine-dir \.\/haylen-engine/);
  assert.match(workflow, /npm run test:playground -- --project=chromium-desktop/);
  assert.match(workflow, /npm run demos:build -- --engine-dir \.\/haylen-engine/);
  assert.match(workflow, /npm run test:demos/);
  assert.match(workflow, /wrangler pages deploy dist/);
  assert.doesNotMatch(workflow, /continue-on-error|--min-success|--only/);
});

test('official favicon is preserved and source contains no old art or Python site code', async () => {
  const source = await readFile(path.join(root, 'src/public/favicon.svg'));
  assert.deepEqual(source, await readFile(path.join(dist, 'favicon.svg')));
  assert.match(source.toString(), /#00d4e9/i);
  assert.match(source.toString(), /#ff7b22/i);
  assert.equal(existsSync(path.join(dist, 'assets/hero-world.svg')), false);
  assert.equal(existsSync(path.join(dist, 'assets/covers')), false);
  assert.ok((await readdir(path.join(root, 'scripts'))).every((file) => file.endsWith('.mjs')));
});

test('WASM validation rejects corrupt binaries, missing HTML and symlinks', async () => {
  await mkdir(path.join(root, '.cache'), { recursive: true });
  const fixture = await mkdtemp(path.join(root, '.cache/wasm-validation-'));
  try {
    await writeFile(path.join(fixture, 'index.html'), '<canvas></canvas>');
    await writeFile(path.join(fixture, 'test.wasm'), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, 1, 255]));
    await assert.rejects(verifyDemo(fixture), /Invalid WebAssembly/);
    await writeFile(path.join(fixture, 'test.wasm'), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
    await verifyDemo(fixture);
    await symlink(path.join(fixture, 'test.wasm'), path.join(fixture, 'linked.wasm'));
    await assert.rejects(verifyDemo(fixture), /Symbolic links/);
    await rm(path.join(fixture, 'linked.wasm'));
    await rm(path.join(fixture, 'index.html'));
    await assert.rejects(verifyDemo(fixture), /ENOENT/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('build injects verified artifacts, rejects an unknown manifest and fails incomplete production', async () => {
  const fixture = await mkdtemp(path.join(root, '.cache/build-contract-'));
  const source = path.join(fixture, 'source');
  const output = path.join(fixture, 'output');
  const slug = catalogue[0].path;
  const demo = path.join(source, slug);
  const run = (extra = {}) =>
    spawnSync(process.execPath, ['scripts/build.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        HAYLEN_WEB_DEMOS_DIR: source,
        HAYLEN_DIST_DIR: output,
        HAYLEN_REQUIRE_ALL_DEMOS: '0',
        ...extra,
      },
      encoding: 'utf8',
    });
  try {
    await mkdir(demo, { recursive: true });
    await writeFile(path.join(demo, 'index.html'), '<!doctype html><title>Packaging fixture</title>');
    await writeFile(path.join(demo, 'fixture.wasm'), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
    await writeFile(
      path.join(source, 'manifest.json'),
      JSON.stringify({ schemaVersion: 1, samples: { [slug]: { available: true } } }),
    );
    const valid = run();
    assert.equal(valid.status, 0, valid.stderr);
    assert.ok(
      (await readFile(path.join(output, 'demos/index.html'), 'utf8')).includes(
        `../web-demos/${slug}/index.html`,
      ),
    );
    assert.deepEqual(
      await readFile(path.join(output, 'web-demos', slug, 'fixture.wasm')),
      await readFile(path.join(demo, 'fixture.wasm')),
    );
    const incomplete = run({ HAYLEN_REQUIRE_ALL_DEMOS: '1' });
    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.stderr, /every sample/);
    await writeFile(
      path.join(source, 'manifest.json'),
      JSON.stringify({ schemaVersion: 1, samples: { '../../outside': { available: true } } }),
    );
    const invalid = run();
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Invalid published sample/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('CI discovery includes new samples, removes deleted ones and refreshes upstream names', async () => {
  const { discoverSamples } = await import('../scripts/build-web-demos.mjs');
  const fixture = await mkdtemp(path.join(root, '.cache/catalogue-contract-'));
  const file = path.join(fixture, 'samples.json');
  try {
    const metadata = [
      {
        path: 'games/example',
        name: 'Old name',
        category: 'Games',
        description: 'Curated description.',
        cover: 'island',
      },
      { path: 'apps/deleted', name: 'Removed', category: 'Apps', description: 'Gone.', cover: 'store' },
    ];
    await writeFile(file, JSON.stringify(metadata));
    for (const [slug, name] of [
      ['games/example', 'Current name'],
      ['apps/new-example', 'New sample'],
      ['tests', 'Engine tests'],
    ]) {
      const directory = path.join(fixture, 'samples', slug);
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, 'app.json'),
        JSON.stringify({ name, identifier: `com.example.${slug.split('/').at(-1)}` }),
      );
    }
    const samples = await discoverSamples(fixture, file);
    assert.equal(samples.length, 3);
    assert.equal(samples.find((sample) => sample.path === 'games/example').name, 'Current name');
    assert.equal(
      samples.find((sample) => sample.path === 'games/example').description,
      'Curated description.',
    );
    assert.equal(
      samples.some((sample) => sample.path === 'apps/deleted'),
      false,
    );
    assert.equal(samples.find((sample) => sample.path === 'apps/new-example').category, 'Apps');
    assert.equal(samples.find((sample) => sample.path === 'apps/new-example').cover, 'engine');
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), samples);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('static release configuration preloads every shard without dropping content', async () => {
  const { prepareStaticDemo } = await import('../scripts/demo-artifacts.mjs');
  const fixture = await mkdtemp(path.join(root, '.cache/static-release-'));
  try {
    await mkdir(path.join(fixture, 'app'));
    const assets = {
      'app.hmanifest': 'app manifest',
      'content.hmanifest': 'content manifest',
      'abc.hpak': 'required content shard',
    };
    for (const [name, bytes] of Object.entries(assets))
      await writeFile(path.join(fixture, 'app', name), bytes);
    await writeFile(
      path.join(fixture, 'config.json'),
      JSON.stringify({ release: { files: ['app.hmanifest'] }, sizes: { 'haylen.wasm': 123 } }),
    );
    await prepareStaticDemo(fixture);
    const config = JSON.parse(await readFile(path.join(fixture, 'config.json'), 'utf8'));
    assert.deepEqual(config.release.files, Object.keys(assets).sort());
    assert.equal(config.sizes['haylen.wasm'], 123);
    for (const [name, bytes] of Object.entries(assets)) {
      assert.equal(config.sizes[`app/${name}`], Buffer.byteLength(bytes));
      assert.equal(await readFile(path.join(fixture, 'app', name), 'utf8'), bytes);
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('C++ static preloading preserves the Emscripten package and adds only unbundled shards', async () => {
  const { prepareStaticDemo } = await import('../scripts/demo-artifacts.mjs');
  const fixture = await mkdtemp(path.join(root, '.cache/cpp-release-'));
  try {
    await mkdir(path.join(fixture, 'app'));
    for (const name of ['app.hmanifest', 'content.hmanifest', 'aaa.hpak', 'bbb.hpak'])
      await writeFile(path.join(fixture, 'app', name), name);
    const runtime =
      'loadPackage({files:[{filename:"/app/app.hmanifest"},{filename:"/app/content.hmanifest"},{filename:"/app/aaa.hpak"}]});';
    await writeFile(path.join(fixture, 'main.js'), runtime);
    await writeFile(
      path.join(fixture, 'index.html'),
      '<!doctype html><script>const script = document.createElement("script"); script.src = "main.js";</script>',
    );
    await prepareStaticDemo(fixture);
    const html = await readFile(path.join(fixture, 'index.html'), 'utf8');
    assert.ok(html.includes('Promise.all(["bbb.hpak"]'));
    assert.ok(html.includes('Module.FS.writeFile'));
    assert.equal(await readFile(path.join(fixture, 'main.js'), 'utf8'), runtime);
    assert.ok(html.includes('script.src = "main.js"'));
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('home contains feature illustrations and local icon libraries, with samples only on web demos', async () => {
  const home = await text('index.html');
  assert.doesNotMatch(home, /assets\/samples\/|web-demos\/[^" ]+\/index\.html/);
  for (const feature of ['rendering', 'physics', 'interface', 'audio', 'plugins', 'development'])
    assert.ok(home.includes(`assets/features/${feature}.svg`));
  assert.match(home, /data-icon-library="fontawesome"/);
  assert.match(home, /class="icon icon-layers"/);
  assert.ok(existsSync(path.join(dist, 'licenses/lucide.txt')));
  assert.ok(existsSync(path.join(dist, 'licenses/fontawesome.txt')));
});
