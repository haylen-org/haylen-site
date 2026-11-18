import { cp, mkdir, readFile, rename, rm, lstat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { maxAssetBytes } from './demo-artifacts.mjs';

// The page mode of the player: `haylen.js` holds both the engine and the page side of
// the runtime, so the worker files of the Worker mode are not part of the playground.
export const runtimeNames = [
  'haylen.js',
  'haylen.wasm',
  'haylen-audio-worklet.js',
  'haylen-content-store.js',
];

// Version 1 of the editor contract, its requests that the playground sends and the page
// fields it sets. The patterns hold for the minified Release runtime too.
const editorContract = [
  /\bprotocol\s*:\s*1\b/,
  /\bhello\s*:/,
  /\bedit\s*:\s*\(/,
  /\bapplyChanges\s*:/,
  /\bpause\s*:/,
  /\bresume\s*:/,
  /\bprojectBudget\b/,
  /\bstorageNamespace\b/,
];

export async function verifyPlayer(directory) {
  for (const name of runtimeNames) {
    const file = path.join(directory, name);
    const info = await lstat(file);
    if (!info.isFile() || info.size === 0 || info.size > maxAssetBytes)
      throw new Error(`Invalid player artifact: ${name}`);
    if (name.endsWith('.wasm') && !WebAssembly.validate(await readFile(file)))
      throw new Error('Invalid playground WebAssembly module');
  }
  const js = await readFile(path.join(directory, 'haylen.js'), 'utf8');
  for (const contract of editorContract)
    if (!contract.test(js)) throw new Error(`The upstream playground API changed: ${contract.source}`);
}

// The web SDK names the folder of its prebuilt player in the files of its slice.
export async function webPlayerFolder(engine) {
  const sdk = path.join(engine, 'build/sdk/web-release');
  const manifestFile = path.join(sdk, 'haylen-sdk.json');
  if (!existsSync(manifestFile))
    throw new Error(
      `The Haylen web SDK was not installed. Run "haylen sdk build --target web" in ${engine}.`,
    );
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  if (manifest.port !== 'web' || manifest.configuration !== 'Release')
    throw new Error('The Haylen web SDK is not a Release build of the web port');
  const player = manifest.slices?.find((slice) => slice.system === 'web')?.files?.player;
  if (typeof player !== 'string') throw new Error('The Haylen web SDK has no player');
  return { folder: path.join(sdk, player), sdkRevision: manifest.revision };
}

export async function stagePlayer(engine, target) {
  const { folder: source, sdkRevision } = await webPlayerFolder(engine);
  await verifyPlayer(source);
  const staging = target + '-staging';
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  for (const name of runtimeNames)
    await cp(path.join(source, name), path.join(staging, name), { dereference: false });
  const git = existsSync(path.join(engine, '.git'))
    ? spawnSync('git', ['-C', engine, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
    : null;
  if (git && (git.error || git.status !== 0))
    throw new Error(`Could not identify the engine revision: ${git.error?.message || git.stderr.trim()}`);
  const revision = git?.status === 0 ? git.stdout.trim() : null;
  if (revision && !/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid engine revision');
  if (!/^[a-f0-9]{64}$/.test(sdkRevision ?? '')) throw new Error('Invalid web SDK revision');
  const sha256 = createHash('sha256')
    .update(await readFile(path.join(staging, 'haylen.wasm')))
    .digest('hex');
  await writeFile(
    path.join(staging, 'manifest.json'),
    JSON.stringify({ schemaVersion: 1, engineRevision: revision, sdkRevision, sha256 }, null, 2) + '\n',
  );
  await rm(target, { recursive: true, force: true });
  await rename(staging, target);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--engine-dir')
    throw new Error('Use --engine-dir <Haylen checkout with an installed web SDK>');
  const root = fileURLToPath(new URL('../', import.meta.url));
  await stagePlayer(path.resolve(args[1]), path.join(root, '.cache/web-player'));
  console.log('Staged the editable Haylen web player.');
}
