import { open, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const samplePathPattern = /^(?:(?:apps|games|stress|cpp)\/[a-z0-9-]+|tests)$/;
export const maxAssetBytes = 25 * 1024 * 1024;

export async function* filesUnder(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not deployable: ${file}`);
    if (entry.isDirectory()) yield* filesUnder(file);
    else if (entry.isFile()) yield file;
    else throw new Error(`Unsupported file type: ${file}`);
  }
}

export async function verifyDemo(directory) {
  const html = path.join(directory, 'index.html');
  if (!(await stat(html)).isFile()) throw new Error(`Missing demo entry point: ${html}`);
  let modules = 0;
  for await (const file of filesUnder(directory)) {
    const { size } = await stat(file);
    if (size > maxAssetBytes) throw new Error(`Cloudflare Pages 25 MiB asset limit exceeded: ${file}`);
    if (!file.endsWith('.wasm')) continue;
    const handle = await open(file, 'r');
    try {
      const bytes = await handle.readFile();
      if (!WebAssembly.validate(bytes)) throw new Error(`Invalid WebAssembly module: ${file}`);
      modules++;
    } finally {
      await handle.close();
    }
  }
  if (!modules) throw new Error(`No WebAssembly module in ${directory}`);
}

export async function prepareStaticDemo(directory) {
  const filename = path.join(directory, 'config.json');
  const config = existsSync(filename) ? JSON.parse(await readFile(filename, 'utf8')) : null;
  if (config && !config.release) return;
  if (config && (!Array.isArray(config.release.files) || !config.sizes || typeof config.sizes !== 'object')) {
    throw new Error(`Invalid Haylen release loader configuration: ${filename}`);
  }
  const content = path.join(directory, 'app');
  if (!existsSync(content)) return;
  const files = [];
  for await (const file of filesUnder(content)) {
    const name = path.relative(content, file).split(path.sep).join('/');
    if (!/^(?:[a-f0-9]+\.hpak|(?:app|content)\.hmanifest)$/.test(name))
      throw new Error(`Unexpected protected release file: ${name}`);
    files.push(name);
    if (config) config.sizes[`app/${name}`] = (await stat(file)).size;
  }
  if (!files.includes('app.hmanifest') || !files.includes('content.hmanifest')) {
    throw new Error(`Incomplete Haylen protected release: ${directory}`);
  }
  // Gallery samples preload their entire release before startup. This keeps their
  // synchronous startup reads independent of background content-store downloads.
  if (config) {
    config.release.files = files.sort();
    await writeFile(filename, JSON.stringify(config, null, 2) + '\n');
    if (config.transparent) {
      const index = path.join(directory, 'index.html');
      const html = await readFile(index, 'utf8');
      await writeFile(
        index,
        html.replace('</head>', '<style>html,body{background:#111827!important}</style></head>'),
      );
    }
    return;
  }
  const index = path.join(directory, 'index.html');
  const html = await readFile(index, 'utf8');
  const marker = 'const script = document.createElement("script");';
  if (html.split(marker).length !== 2)
    throw new Error('The upstream C++ runtime loader changed; review static release preloading');
  const runtimeName = html.match(/script\.src = "([a-zA-Z0-9-]+\.js)";/)?.[1];
  if (!runtimeName) throw new Error('Missing native C++ runtime script');
  const runtime = await readFile(path.join(directory, runtimeName), 'utf8');
  const bundled = new Set([...runtime.matchAll(/filename:"\/app\/([^"]+)"/g)].map((match) => match[1]));
  if (!bundled.has('app.hmanifest') || !bundled.has('content.hmanifest'))
    throw new Error('The upstream C++ package format changed; review static preloading');
  const additional = files.filter((name) => !bundled.has(name)).sort();
  const preload = `const staticContent = await Promise.all(${JSON.stringify(additional)}.map(async (name) => {
    const response = await fetch(new URL("app/" + name, document.baseURI));
    if (!response.ok) throw new Error("Could not load sample content: " + name);
    return {name, bytes: new Uint8Array(await response.arrayBuffer())};
  }));
  Module.preRun.push(() => {
    Module.FS.mkdirTree("/app");
    for (const file of staticContent) Module.FS.writeFile("/app/" + file.name, file.bytes);
  });
  ${marker}`;
  await writeFile(index, html.replace(marker, preload));
}
