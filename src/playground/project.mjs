// Canonical project state. Runtime files and editor views are disposable copies.
export const limits = Object.freeze({ files: 1000, fileBytes: 16 * 1024 * 1024, bytes: 64 * 1024 * 1024 });
export const encoder = new TextEncoder();
export const decoder = new TextDecoder();

export function cleanPath(value) {
  if (typeof value !== 'string' || value.length > 240 || /[\\\x00-\x1f\x7f:*?"<>|]/.test(value))
    throw new Error('Use a relative path without special characters.');
  const path = value.normalize('NFC');
  if (path.split('/').includes('__proto__')) throw new Error('That name is reserved.');
  if (!path || path.split('/').some((part) => !part || part === '.' || part === '..' || part.trim() !== part))
    throw new Error('Use a relative path such as source/player.lua.');
  return path;
}

export class Project {
  constructor(files = [], folders = []) {
    this.files = new Map();
    this.folders = new Set();
    this.import(files, folders);
  }
  import(files, folders = []) {
    const next = new Map(this.files);
    const dirs = new Set(this.folders);
    const imported = new Set();
    for (const folder of folders) dirs.add(cleanPath(folder));
    for (const [name, value] of files) {
      const path = cleanPath(name);
      if (imported.has(path)) throw new Error(`Duplicate imported path: ${path}`);
      imported.add(path);
      const bytes = typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value);
      if (bytes.byteLength > limits.fileBytes) throw new Error(`${path} exceeds the 16 MiB file limit.`);
      next.set(path, bytes);
      const parts = path.split('/');
      parts.pop();
      while (parts.length) {
        dirs.add(parts.join('/'));
        parts.pop();
      }
    }
    for (const dir of [...dirs]) {
      const parts = dir.split('/');
      parts.pop();
      while (parts.length) {
        dirs.add(parts.join('/'));
        parts.pop();
      }
    }
    if (next.size + dirs.size > limits.files)
      throw new Error('A project can contain up to 1,000 files and folders.');
    if ([...next.values()].reduce((sum, bytes) => sum + bytes.length, 0) > limits.bytes)
      throw new Error('The project exceeds the 64 MiB limit.');
    for (const dir of dirs) if (next.has(dir)) throw new Error(`${dir} is both a file and a folder.`);
    this.files = next;
    this.folders = dirs;
  }
  has(path) {
    return this.files.has(path) || this.folders.has(path);
  }
  add(path, folder = false) {
    path = cleanPath(path);
    if (this.has(path)) throw new Error('That name is already in use.');
    this.import(folder ? [] : [[path, '']], folder ? [path] : []);
  }
  move(from, to) {
    to = cleanPath(to);
    if (!this.has(from)) throw new Error('The selected item no longer exists.');
    if (from === to) return;
    if (this.has(to)) throw new Error('That destination already exists.');
    if (to.startsWith(from + '/')) throw new Error('A folder cannot be moved into itself.');
    const rename = (path) =>
      path === from || path.startsWith(from + '/') ? to + path.slice(from.length) : path;
    const result = new Project(
      [...this.files].map(([p, b]) => [rename(p), b]),
      [...this.folders].map(rename),
    );
    this.files = result.files;
    this.folders = result.folders;
  }
  remove(path) {
    for (const name of this.files.keys())
      if (name === path || name.startsWith(path + '/')) this.files.delete(name);
    for (const name of this.folders)
      if (name === path || name.startsWith(path + '/')) this.folders.delete(name);
  }
  text(path) {
    return decoder.decode(this.files.get(path));
  }
  entries() {
    return [...this.files].map(([path, bytes]) => [path, bytes.slice()]);
  }
}

export const isText = (path) =>
  /\.(lua|json|txt|md|csv|xml|svg|vert|frag|glsl|wgsl|js|ts|html|css|yaml|yml|ini|toml)$/i.test(path);

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('haylen-playground', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other playground tabs to update local storage.'));
  });
}

const persisted = new Map();
export function storage(db, action, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspace', action === 'load' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('workspace');
    let result;
    if (action === 'load') {
      const request = store.getAll();
      request.onsuccess = () => {
        const rows = request.result;
        result = rows.find((row) => row.kind === 'meta');
        if (result) {
          result.files = rows.filter((row) => row.kind === 'file').map(({ path, bytes }) => [path, bytes]);
          for (const [path, bytes] of result.files) persisted.set(path, bytes);
        }
      };
    } else {
      const next = new Map(value.files);
      for (const path of persisted.keys()) if (!next.has(path)) store.delete('file:' + path);
      for (const [path, bytes] of next)
        if (persisted.get(path) !== bytes) store.put({ kind: 'file', path, bytes }, 'file:' + path);
      const { files, ...meta } = value;
      store.put({ ...meta, kind: 'meta' }, 'project');
      result = next;
    }
    tx.oncomplete = () => {
      if (action !== 'load') {
        persisted.clear();
        for (const entry of result) persisted.set(...entry);
      }
      resolve(action === 'load' ? result : undefined);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Local save was interrupted.'));
  });
}
