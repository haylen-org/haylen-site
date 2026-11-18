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

// Every Haylen web site, Lua or C++, has the upstream loader and its `config.json`. The
// runtime would stream content shards by byte range, but Cloudflare Pages answers ranges
// of uncached `.hpak` files with the whole file, which the runtime refuses. So the loader
// downloads every shard of the release before startup, as it does for the app domain,
// and no range request is made. Transparent apps also get a dark page background.
export async function prepareStaticDemo(directory) {
  const filename = path.join(directory, 'config.json');
  if (!existsSync(filename)) throw new Error(`The upstream web loader changed; missing ${filename}`);
  const config = JSON.parse(await readFile(filename, 'utf8'));
  if (!config.sizes || typeof config.sizes !== 'object')
    throw new Error(`Invalid Haylen loader configuration: ${filename}`);
  if (config.release) {
    if (!Array.isArray(config.release.files))
      throw new Error(`Invalid Haylen release configuration: ${filename}`);
    const content = path.join(directory, 'app');
    const files = [];
    for await (const file of filesUnder(content)) {
      const name = path.relative(content, file).split(path.sep).join('/');
      if (!/^(?:[a-f0-9]+\.hpak|(?:app|content)\.hmanifest)$/.test(name))
        throw new Error(`Unexpected protected release file: ${name}`);
      files.push(name);
      config.sizes[`app/${name}`] = (await stat(file)).size;
    }
    for (const name of ['app.hmanifest', 'content.hmanifest', ...config.release.files])
      if (!files.includes(name))
        throw new Error(`Incomplete Haylen protected release: ${directory} (${name})`);
    config.release.files = files.sort();
    await writeFile(filename, JSON.stringify(config, null, 2) + '\n');
  }
  if (config.transparent) {
    const index = path.join(directory, 'index.html');
    const html = await readFile(index, 'utf8');
    await writeFile(
      index,
      html.replace('</head>', '<style>html,body{background:#111827!important}</style></head>'),
    );
  }
}
