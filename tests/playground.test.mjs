import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { Project, cleanPath, limits } from '../src/playground/project.mjs';
import { pack, unpack } from '../src/playground/archive.mjs';
import { zipSync, strToU8 } from 'fflate';

test('project paths, folder operations and conflicts are atomic', () => {
  for (const path of ['../secret', '/file', 'a/../b', 'C:/key', 'a\\b', 'a//b', 'a/./b', 'file\u0000.lua'])
    assert.throws(() => cleanPath(path));
  const p = new Project([
    ['app.json', '{}'],
    ['source/main.lua', 'print(1)'],
    ['content/image.png', new Uint8Array([1, 2])],
  ]);
  p.add('empty', true);
  const originalMain = p.files.get('source/main.lua');
  const originalConfig = p.files.get('app.json');
  p.move('source', 'game/scripts');
  assert.strictEqual(p.files.get('game/scripts/main.lua'), originalMain);
  assert.strictEqual(p.files.get('app.json'), originalConfig);
  const candidate = p.fork();
  candidate.import([['content/new.png', new Uint8Array([3, 4])]]);
  assert.strictEqual(candidate.files.get('app.json'), originalConfig);
  assert.equal(p.has('content/new.png'), false);
  assert.equal(candidate.has('content/new.png'), true);
  assert.equal(p.text('game/scripts/main.lua'), 'print(1)');
  assert.ok(p.folders.has('game'));
  assert.throws(() => p.move('game', 'game/subfolder'));
  assert.throws(() => p.move('app.json', 'empty'));
  assert.throws(() => p.import([['empty', 'conflict']]));
  assert.ok(p.folders.has('empty'));
  p.move('content/image.png', 'content/moved/image.png');
  assert.deepEqual([...p.files.get('content/moved/image.png')], [1, 2]);
  p.remove('content');
  assert.equal(
    [...p.files.keys()].some((path) => path.startsWith('content/')),
    false,
  );
  assert.throws(() => p.import([['huge.bin', new Uint8Array(limits.fileBytes + 1)]]));
  assert.equal(p.files.has('huge.bin'), false);
  assert.throws(
    () =>
      p.import([
        ['café.lua', 'one'],
        ['cafe\u0301.lua', 'two'],
      ]),
    /Duplicate/,
  );
});

test('ZIP roundtrip preserves source, binary images and empty folders', async () => {
  const p = new Project(
    [
      ['app.json', '{}'],
      ['source/main.lua', '-- Lua\nprint("hello")'],
      ['content/test.png', new Uint8Array([137, 80, 78, 71, 0, 255])],
    ],
    ['empty'],
  );
  const restored = await unpack(await pack(p));
  assert.equal(restored.text('source/main.lua'), p.text('source/main.lua'));
  assert.deepEqual(restored.files.get('content/test.png'), p.files.get('content/test.png'));
  assert.ok(restored.folders.has('empty'));
});

test('ZIP import rejects traversal, duplicate paths, missing entry points and oversized expansion', async () => {
  for (const entries of [
    { '../bad.lua': strToU8('no') },
    { 'app.json': strToU8('{}') },
    { 'huge.bin': new Uint8Array(limits.fileBytes + 1) },
  ])
    await assert.rejects(async () => unpack(zipSync(entries)));
  await assert.rejects(async () => unpack(new Uint8Array([0, 1, 2, 3])));
});

test('playground bundles and offline cache stay local and outside the sample cache', async () => {
  const html = await readFile('dist/playground/index.html', 'utf8');
  assert.match(html, /type="module" src="\.\/editor.js"/);
  const home = await readFile('dist/index.html', 'utf8');
  assert.doesNotMatch(home, /editor.js|editor.css/);
  const worker = await readFile('dist/playground/sw.js', 'utf8');
  assert.match(worker, /\/playground\/runtime/);
  assert.doesNotMatch(worker, /web-demos/);
  assert.doesNotMatch(worker, /skipWaiting/);
  assert.match(await readFile('dist/licenses/playground.txt', 'utf8'), /CodeMirror|codemirror/);
});
