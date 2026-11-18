// Only this disposable frame owns the native player. Project data stays in the host.
const token = location.hash.slice(1);
const editorProtocol = 1;
let port;
const send = (type, detail = {}) => port?.postMessage({ type, detail });

// The same limits as the editor, so the player refuses nothing the editor accepts.
const projectBudget = { files: 1000, bytes: 64 * 1024 * 1024 };

// Every request goes through the versioned editor contract of the Haylen web runtime.
// Requests made before the runtime starts wait for it, and each one answers in order.
const request = (method, params) => window.Module.haylen.editor.request(method, params);

function editOperations(files, removed = []) {
  return [
    ...removed.map((path) => ({ op: 'remove', path })),
    ...files.map(([path, content]) => ({ op: 'write', path, content })),
  ];
}

// Batches of changes apply one at a time, so an edit never interleaves with the reload
// of the batch before it. A paused app answers `applyChanges` only once it resumes, so
// Pause and Resume never wait behind a batch.
let changes = Promise.resolve();
function command(message) {
  const failed = (error) => send('error', { message: error.message });
  if (message.type === 'changes') changes = changes.then(() => applyChanges(message.detail)).catch(failed);
  else if (message.type === 'pause') request('pause').then(() => send('paused'), failed);
  else if (message.type === 'resume') request('resume').then(() => send('resumed'), failed);
}

async function applyChanges({ files, removed }) {
  await request('edit', { operations: editOperations(files, removed) });
  const { report } = await request('applyChanges');
  // A batch that touched no file the app has loaded yet answers without a report.
  send(
    'reloaded',
    report ?? { restarted: false, modules: [], restored: [], assets: [], rejected: [], resumed: false },
  );
}

async function checkContract() {
  const { protocol, capabilities } = await request('hello');
  if (protocol !== editorProtocol || !capabilities.packageEditing || !capabilities.developmentReload)
    send('fatal', {
      message:
        'This preview player does not match the editor. Reload the page to get the current playground.',
    });
}

window.addEventListener('message', ({ source, origin, data, ports }) => {
  if (
    port ||
    source !== parent ||
    origin !== location.origin ||
    data?.haylenPlayground !== token ||
    data.type !== 'boot' ||
    !ports[0]
  )
    return;
  port = ports[0];
  port.onmessage = ({ data: message }) => command(message);
  window.Module = {
    canvas: document.querySelector('canvas'),
    locateFile: (file) => new URL(`./runtime/${file}`, location.href).href,
    print: (line) => send('log', { line: String(line), level: 'info' }),
    printErr: (line) => send('log', { line: String(line), level: 'warning' }),
    onAbort: (message) => send('fatal', { message: String(message) }),
    haylen: {
      development: true,
      graphicsApi: 'webGl2',
      packageData: data.detail.bytes,
      projectBudget,
      // Playground saves stay apart from the gallery samples served by the same origin.
      storageNamespace: 'playground',
      onLog: (level, line) => send('log', { level, line }),
      onStarted: (app) => {
        document.querySelector('#loading').hidden = true;
        send('started', app);
      },
      onStopped: () => send('stopped'),
      onError: (error) => {
        document.querySelector('#loading').hidden = true;
        send('error', error);
      },
      onStats: (stats) => send('stats', { fps: stats.fps, drawCalls: stats.drawCalls }),
    },
  };
  const script = document.createElement('script');
  script.src = './runtime/haylen.js';
  script.onload = () => checkContract().catch((error) => send('fatal', { message: error.message }));
  script.onerror = () =>
    send('fatal', {
      message: 'The preview could not load. Connect to the internet and reload this tab, then press Play.',
    });
  document.head.append(script);
});
window.addEventListener('error', (event) => {
  // Browser resize delivery can defer a notification without stopping the app.
  if (
    !event.error &&
    [
      'ResizeObserver loop completed with undelivered notifications.',
      'ResizeObserver loop limit exceeded',
    ].includes(event.message)
  )
    return;
  send('fatal', { message: event.message });
});
window.addEventListener('unhandledrejection', (event) => send('fatal', { message: String(event.reason) }));
parent.postMessage({ haylenPlayground: token, type: 'ready' }, location.origin);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') send('escape');
});
