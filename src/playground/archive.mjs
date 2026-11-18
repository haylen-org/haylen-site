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
    if (names.has(file.name))
      throw new Error(
        'This ZIP contains duplicate file names. Rename the duplicates and create the ZIP again.',
      );
    names.add(file.name);
    if (++count > limits.files)
      throw new Error('This ZIP contains more than 1,000 files and folders. Remove some and try again.');
    if (file.originalSize > limits.fileBytes)
      throw new Error('A file inside this ZIP is larger than 16 MB. Use smaller files and try again.');
    let size = 0;
    file.ondata = (error, chunk) => {
      if (error) throw error;
      size += chunk.length;
      total += chunk.length;
      if (size > limits.fileBytes || total > limits.bytes)
        throw new Error(
          'This project is too large. Each file can be up to 16 MB, and the whole project up to 64 MB.',
        );
    };
    file.start();
  });
  probe.register(UnzipInflate);
  if (bytes.length > limits.bytes) throw new Error('This ZIP is too large. Choose one smaller than 64 MB.');
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
            throw new Error(
              'Some files in this ZIP do not match its contents list. Create a new ZIP and try again.',
            );
          centralNames.add(file.name);
          centralBytes += file.originalSize;
          if (
            centralNames.size > limits.files ||
            file.originalSize > limits.fileBytes ||
            centralBytes > limits.bytes
          )
            throw new Error(
              'This project is too large. Use up to 1,000 files and folders, 16 MB per file and 64 MB in total.',
            );
          return true;
        },
      },
      (error, entries) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          if (centralNames.size !== names.size)
            throw new Error('This ZIP is incomplete. Create a new ZIP and try again.');
          const files = [];
          const folders = [];
          for (const [path, content] of Object.entries(entries)) {
            if (path.endsWith('/')) folders.push(path.slice(0, -1));
            else files.push([path, content]);
          }
          const project = new Project(files, folders);
          if (!project.files.has('haylen.json') && project.files.has('app.json'))
            throw new Error(
              'This ZIP has app.json from an older Haylen project. Rename it to haylen.json, create the ZIP again and import it.',
            );
          if (!project.files.has('haylen.json') || !project.files.has('source/main.lua'))
            throw new Error(
              'This ZIP needs haylen.json at the top level and main.lua inside a source folder. Do not wrap the project in an extra folder.',
            );
          resolve(project);
        } catch (reason) {
          reject(reason);
        }
      },
    ),
  );
}
