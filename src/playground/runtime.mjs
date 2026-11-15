// Only this disposable frame owns the native player. Project data stays in the host.
const token = location.hash.slice(1);
let port;
const send = (type, detail = {}) => port?.postMessage({ type, detail });

function command({ type, detail }) {
  try {
    const api = window.Module?.haylen;
    if (!api?.setFile) return;
    if (type === 'changes') {
      for (const path of detail.removed) api.removeFile(path);
      for (const [path, bytes] of detail.files) api.setFile(path, bytes);
      api.applyChanges();
    } else if (type === 'run') {
      api.clearFiles();
      for (const [path, bytes] of detail.files) api.setFile(path, bytes);
      api.run();
    } else if (type === 'pause') {
      api.pause();
      send('paused');
    } else if (type === 'resume') {
      api.resume();
      send('resumed');
    } else if (type === 'stop') api.stop();
  } catch (error) {
    send('error', { message: error.message });
  }
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
      onReloaded: (report) => send('reloaded', report),
      onStats: (stats) => send('stats', { fps: stats.fps, drawCalls: stats.drawCalls }),
    },
  };
  const script = document.createElement('script');
  script.src = './runtime/haylen.js';
  script.onerror = () =>
    send('fatal', { message: 'The Haylen player could not load. Reconnect once to prepare offline use.' });
  document.head.append(script);
});
window.addEventListener('error', (event) => send('fatal', { message: event.message }));
window.addEventListener('unhandledrejection', (event) => send('fatal', { message: String(event.reason) }));
parent.postMessage({ haylenPlayground: token, type: 'ready' }, location.origin);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') send('escape');
});
