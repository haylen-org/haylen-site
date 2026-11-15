import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { filesUnder } from './demo-artifacts.mjs';
import { runtimeNames, verifyPlayer } from './playground-runtime.mjs';

export async function buildPlayground(root, dist) {
  const source = path.join(root, '.cache/web-player');
  const available = existsSync(source);
  if (!available && process.env.HAYLEN_REQUIRE_PLAYGROUND_RUNTIME === '1')
    throw new Error(
      'Production requires the editable Haylen playground player. Run npm run playground:runtime.',
    );
  if (available) {
    await verifyPlayer(source);
    const manifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
    const digest = createHash('sha256')
      .update(await readFile(path.join(source, 'haylen.wasm')))
      .digest('hex');
    if (
      manifest.schemaVersion !== 1 ||
      manifest.sha256 !== digest ||
      (manifest.engineRevision !== null && !/^[a-f0-9]{40}$/.test(manifest.engineRevision))
    )
      throw new Error('Invalid playground player provenance');
    await mkdir(path.join(dist, 'playground/runtime'), { recursive: true });
    for (const name of [...runtimeNames, 'manifest.json'])
      await cp(path.join(source, name), path.join(dist, 'playground/runtime', name));
  }
  const bundle = await build({
    absWorkingDir: root,
    entryPoints: { editor: 'src/playground/editor.mjs', 'runtime-host': 'src/playground/runtime.mjs' },
    outdir: path.join(dist, 'playground'),
    bundle: true,
    external: ['./starter/*'],
    format: 'esm',
    minify: true,
    target: ['chrome111', 'firefox128', 'safari16.4'],
    legalComments: 'external',
    metafile: true,
  });
  const examples = JSON.parse(await readFile(path.join(root, 'src/data/playground-examples.json'), 'utf8'));
  const ids = new Set();
  for (const example of examples.projects) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(example.id) || ids.has(example.id))
      throw new Error('Invalid or duplicate playground example ID.');
    if (!/^(?:starter|examples\/[a-z0-9-]+)$/.test(example.directory))
      throw new Error('Invalid playground example directory.');
    ids.add(example.id);
    const source = path.join(root, 'src/public/playground', example.directory);
    const files = [];
    for await (const file of filesUnder(source))
      files.push(path.relative(source, file).split(path.sep).join('/'));
    for (const required of ['app.json', 'source/main.lua', example.preview])
      if (!files.includes(required)) throw new Error(`Example ${example.id} is missing ${required}.`);
    example.files = files.sort();
  }
  if (!ids.has(examples.default)) throw new Error('Missing default playground example.');
  await writeFile(path.join(dist, 'playground/examples.json'), JSON.stringify(examples) + '\n');
  // Keep MIT notices with the static bundle, including transitive editor packages.
  const packages = [
    ...new Set(
      Object.keys(bundle.metafile.inputs).flatMap((file) => {
        const match = file.match(/(?:^|\/)node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
        return match ? [match[1]] : [];
      }),
    ),
  ].sort();
  const notices = [];
  for (const name of packages) {
    let license;
    for (const filename of ['LICENSE', 'LICENSE.txt'])
      if (existsSync(path.join(root, 'node_modules', name, filename))) {
        license = await readFile(path.join(root, 'node_modules', name, filename), 'utf8');
        break;
      }
    if (!license) throw new Error(`Missing browser dependency license: ${name}`);
    notices.push(`${name}\n${license}`);
  }
  await writeFile(path.join(dist, 'licenses/playground.txt'), notices.join('\n\n'));
  return available;
}

export async function buildOfflineCache(dist, available) {
  const paths = [
    '/playground/',
    '/assets/site.css',
    '/assets/main.js',
    '/favicon.svg',
    '/assets/brand/logo.svg',
  ];
  for await (const file of filesUnder(path.join(dist, 'playground'))) {
    const relative = path.relative(dist, file).split(path.sep).join('/');
    if (relative === 'playground/index.html' || relative.endsWith('.LEGAL.txt')) continue;
    paths.push('/' + (relative === 'playground/runtime.html' ? 'playground/runtime' : relative));
  }
  paths.sort();
  const hash = createHash('sha256');
  for (const url of paths) {
    hash.update(url);
    hash.update(
      await readFile(
        path.join(
          dist,
          url === '/playground/'
            ? 'playground/index.html'
            : url === '/playground/runtime'
              ? 'playground/runtime.html'
              : url.slice(1),
        ),
      ),
    );
  }
  const version = hash.digest('hex').slice(0, 20);
  await writeFile(
    path.join(dist, 'playground/sw.js'),
    `// Generated from the complete static playground. Never cache native sample folders.
const CACHE = 'haylen-playground-${version}';
const ASSETS = ${JSON.stringify(paths)};
const READY = ${available};
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try {
    for (const url of ASSETS) {
      const response = await fetch(new Request(url, {cache: 'reload'}));
      if (!response.ok) throw new Error('Offline asset failed: ' + url);
      await cache.put(url, response);
    }
  } catch (error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('haylen-playground-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data?.type === 'activate-update') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'status') event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const complete = (await Promise.all(ASSETS.map(url => cache.match(url)))).every(Boolean);
    event.ports[0]?.postMessage({ready: READY && complete});
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(url.pathname);
    try {
      const response = await fetch(new Request(event.request, {cache: 'no-cache'}));
      return response.status < 500 || !saved ? response : saved;
    } catch (error) {
      if (saved) return saved;
      throw error;
    }
  })());
});
`,
  );
}
