import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { samplePathPattern, verifyDemo } from './demo-artifacts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

export function desktopContentTool(engine, platform = process.platform, arch = process.arch) {
  const host = { darwin: 'macos', linux: 'linux', win32: 'windows' }[platform];
  if (!host || !['arm64', 'x64'].includes(arch))
    throw new Error(`Unsupported host for native sample content keys: ${platform}/${arch}`);
  return path.join(
    engine,
    'build/artifacts/desktop',
    `${host}-${arch}`,
    platform === 'win32' ? 'haylen-content.exe' : 'haylen-content',
  );
}

function parseArguments(args) {
  const options = { engineDir: null, jobs: 3, config: 'Release', only: [] };
  const names = { '--engine-dir': 'engineDir', '--jobs': 'jobs', '--config': 'config', '--only': 'only' };
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!(key in names) || !args[i + 1]) throw new Error(`Unknown or incomplete argument: ${key}`);
    const value = args[++i];
    if (key === '--only') options.only.push(value);
    else if (key === '--jobs') options.jobs = Number(value);
    else options[names[key]] = value;
  }
  if (!options.engineDir) throw new Error('Required: --engine-dir /path/to/haylen');
  if (!Number.isInteger(options.jobs) || options.jobs < 1)
    throw new Error('--jobs must be a positive integer');
  if (!['Debug', 'Release'].includes(options.config)) throw new Error('--config must be Debug or Release');
  return options;
}

export async function discoverSamples(engine, catalogueFile = path.join(root, 'src/data/samples.json')) {
  const samplesDir = path.join(engine, 'samples');
  const metadata = JSON.parse(await readFile(catalogueFile, 'utf8'));
  const discovered = new Map();
  const categories = { apps: 'Apps', games: 'Games', stress: 'Stress', cpp: 'C++', tests: 'Tests' };
  for (const entry of await readdir(samplesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const category = categories[entry.name];
    const parent = path.join(samplesDir, entry.name);
    const paths = existsSync(path.join(parent, 'app.json'))
      ? [entry.name]
      : (await readdir(parent, { withFileTypes: true }))
          .filter((child) => child.isDirectory() && existsSync(path.join(parent, child.name, 'app.json')))
          .map((child) => `${entry.name}/${child.name}`);
    for (const slug of paths) {
      if (!category || !samplePathPattern.test(slug))
        throw new Error(`New sample requires a supported category/path: ${slug}`);
      const app = JSON.parse(await readFile(path.join(samplesDir, slug, 'app.json'), 'utf8'));
      if (typeof app.name !== 'string' || !app.name.trim()) throw new Error(`Missing sample name: ${slug}`);
      const existing = metadata.find((sample) => sample.path === slug);
      discovered.set(slug, {
        ...existing,
        path: slug,
        name: app.name,
        category,
        description:
          existing?.description ||
          app.description ||
          `${app.name}: explore this ${category.toLowerCase()} sample built with Haylen.`,
        cover: existing?.cover || 'engine',
      });
    }
  }
  if (!discovered.size) throw new Error('No sample apps discovered in the engine checkout');
  const ordered = [
    ...metadata.filter((sample) => discovered.has(sample.path)).map((sample) => discovered.get(sample.path)),
    ...[...discovered.values()].filter((sample) => !metadata.some((item) => item.path === sample.path)),
  ];
  await writeFile(catalogueFile, JSON.stringify(ordered, null, 2) + '\n');
  return ordered;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const engine = await realpath(options.engineDir);
  const output = path.join(root, '.cache/web-demos');
  const staging = path.join(root, '.cache/web-demos-staging');
  if (!existsSync(path.join(engine, 'haylen.py'))) throw new Error(`Not a Haylen checkout: ${engine}`);
  const samples = await discoverSamples(engine);
  const only = new Set(options.only);
  for (const slug of only)
    if (!samples.some((sample) => sample.path === slug)) throw new Error(`Unknown sample: ${slug}`);
  const chosen = only.size ? samples.filter((sample) => only.has(sample.path)) : samples;
  await rm(output, { force: true, recursive: true });
  await rm(staging, { force: true, recursive: true });
  await mkdir(staging, { recursive: true });
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: engine, encoding: 'utf8' });
  const manifest = {
    schemaVersion: 1,
    engineRevision: revision.status === 0 ? revision.stdout.trim() : null,
    configuration: options.config,
    shardTargetBytes: options.config === 'Release' ? 8 * 1024 ** 2 : null,
    samples: {},
  };

  const python = process.env.HAYLEN_PYTHON || 'python3';
  const runEngine = (args, env = process.env, release = false) => {
    // Haylen exposes the shard target on its content builder, but not on `run`.
    // Configure that upstream module in memory. Eight MiB targets leave room for
    // its bounded shard overhead under Cloudflare Pages' 25 MiB file limit.
    const entry = release
      ? ['-c', 'import haylen; haylen.CONTENT_SHARD_TARGETS["web"] = 8 * 1024**2; haylen.main()']
      : [path.join(engine, 'haylen.py')];
    const result = spawnSync(python, [...entry, '--verbose', ...args], {
      cwd: engine,
      stdio: 'inherit',
      env,
    });
    if (result.error || result.status !== 0)
      throw new Error(
        `Haylen failed (${result.error?.message ?? result.status}). Nothing will be published.`,
      );
  };
  let buildEnv = process.env;
  if (options.config === 'Release' && !process.env.HAYLEN_KEYS_DIR) {
    const tool = desktopContentTool(engine);
    runEngine(['engine', '--platform', 'desktop', '--config', 'Release', '--jobs', String(options.jobs)]);
    if (!existsSync(tool)) throw new Error(`Haylen content tool was not generated: ${tool}`);
    const keys = path.join(root, '.cache/sample-keys');
    for (const sample of chosen) {
      const app = JSON.parse(await readFile(path.join(engine, 'samples', sample.path, 'app.json'), 'utf8'));
      if (!/^[a-zA-Z0-9]+(?:\.[a-zA-Z0-9-]+)+$/.test(app.identifier))
        throw new Error(`Invalid app identifier: ${sample.path}`);
      const directory = path.join(keys, app.identifier);
      if (existsSync(path.join(directory, 'keys.json'))) continue;
      const result = spawnSync(tool, ['keys', 'create', directory, '--identifier', app.identifier], {
        cwd: engine,
        stdio: 'inherit',
      });
      if (result.error || result.status !== 0)
        throw new Error(
          `Could not create disposable public sample keys: ${sample.path} (${result.error?.message ?? `exit code ${result.status}`})`,
        );
    }
    buildEnv = { ...process.env, HAYLEN_KEYS_DIR: keys };
  }

  for (const sample of chosen) {
    const app = await realpath(path.join(engine, 'samples', sample.path));
    console.log(`\nBuilding ${sample.path}`);
    // Python belongs to the upstream Haylen compiler. The website uses only Node.js.
    runEngine(
      [
        'run',
        app,
        '--platform',
        'web',
        '--config',
        options.config,
        '--build-only',
        '--jobs',
        String(options.jobs),
      ],
      buildEnv,
      options.config === 'Release',
    );
    const hash = createHash('sha256').update(app).digest('hex').slice(0, 8);
    const source = path.join(
      engine,
      'build',
      sample.category === 'C++' ? 'cpp' : 'apps',
      `${path.basename(app)}-${hash}`,
      'web',
    );
    await verifyDemo(source);
    const destination = path.join(staging, sample.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true, force: false, errorOnExist: true });
    manifest.samples[sample.path] = { available: true, name: sample.name };
    console.log(`Verified ${sample.path}/index.html and WebAssembly assets`);
  }
  await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const { rename } = await import('node:fs/promises');
  await rename(staging, output);
  console.log(`\nWebAssembly builds ready: ${chosen.length}/${chosen.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Web demos: ${error.message}`);
    process.exitCode = 1;
  });
}
