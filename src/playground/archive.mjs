import { zip, unzip, Unzip, UnzipInflate } from 'fflate';
import { Project, cleanPath, limits } from './project.mjs';

export function pack(project) {
  const files = Object.create(null);
  for (const path of project.folders) files[path + '/'] = new Uint8Array();
  for (const [path, bytes] of project.files) files[path] = bytes;
  return new Promise((resolve, reject) =>
    zip(files, { level: 1 }, (error, bytes) => (error ? reject(error) : resolve(bytes))),
  );
}

export function unpack(bytes) {
  // Check paths and declared expansion before handing work to asynchronous workers.
  // Streaming validation also caps actual expansion; forged ZIP sizes cannot bypass it.
  let total = 0;
  let count = 0;
  const names = new Set();
  const probe = new Unzip((file) => {
    const name = file.name.endsWith('/') ? file.name.slice(0, -1) : file.name;
    cleanPath(name);
    if (names.has(file.name)) throw new Error('Duplicate ZIP entry.');
    names.add(file.name);
    if (++count > limits.files) throw new Error('Too many files in the ZIP.');
    if (file.originalSize > limits.fileBytes) throw new Error('A ZIP entry exceeds 16 MiB.');
    let size = 0;
    file.ondata = (error, chunk) => {
      if (error) throw error;
      size += chunk.length;
      total += chunk.length;
      if (size > limits.fileBytes || total > limits.bytes)
        throw new Error('The ZIP exceeds the project size limits.');
    };
    file.start();
  });
  probe.register(UnzipInflate);
  if (bytes.length > limits.bytes) throw new Error('The ZIP exceeds 64 MiB.');
  probe.push(bytes, true);
  let centralBytes = 0;
  const centralNames = new Set();
  return new Promise((resolve, reject) =>
    unzip(
      bytes,
      {
        filter: (file) => {
          cleanPath(file.name.endsWith('/') ? file.name.slice(0, -1) : file.name);
          if (centralNames.has(file.name) || !names.has(file.name))
            throw new Error('The ZIP directory is inconsistent.');
          centralNames.add(file.name);
          centralBytes += file.originalSize;
          if (
            centralNames.size > limits.files ||
            file.originalSize > limits.fileBytes ||
            centralBytes > limits.bytes
          )
            throw new Error('The ZIP directory exceeds project limits.');
          return true;
        },
      },
      (error, entries) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          if (centralNames.size !== names.size) throw new Error('The ZIP directory is incomplete.');
          const files = [];
          const folders = [];
          for (const [path, content] of Object.entries(entries)) {
            if (path.endsWith('/')) folders.push(path.slice(0, -1));
            else files.push([path, content]);
          }
          const project = new Project(files, folders);
          if (!project.files.has('app.json') || !project.files.has('source/main.lua'))
            throw new Error('The ZIP needs app.json and source/main.lua at its root.');
          resolve(project);
        } catch (reason) {
          reject(reason);
        }
      },
    ),
  );
}
