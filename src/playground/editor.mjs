import { basicSetup, EditorView } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { search } from '@codemirror/search';
import { StreamLanguage, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { javascript } from '@codemirror/legacy-modes/mode/javascript';
import { xml } from '@codemirror/legacy-modes/mode/xml';
import { css } from '@codemirror/legacy-modes/mode/css';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, setDiagnostics } from '@codemirror/lint';
import { Project, encoder, isText, openDatabase, storage, limits, cleanPath } from './project.mjs';
import { pack, unpack } from './archive.mjs';
import { PlayerBridge } from './bridge.mjs';
import { WorkspaceLayout } from './workspace-layout.mjs';
import { Notifications } from './notifications.mjs';
import { SearchPanel } from './search-panel.mjs';
import { ExampleProjects } from './examples.mjs';
import { PreviewViewport } from './preview-viewport.mjs';
import { OfflineCache } from './offline-cache.mjs';
import './editor.css';

const $ = (selector) => document.querySelector(selector);
const runtimeAvailable = $('.playground').dataset.runtime === 'available';
const notices = new Notifications();
const examples = new ExampleProjects();
new PreviewViewport();
let exampleRequest = 0;
const status = (text) => notices.show(text);
let project = new Project();
let active = '';
let selected = '';
let db;
let view;
let assetUrl;
let saveTimer;
let hotTimer;
let saveRevision = 0;
let savedRevision = 0;
let saving = Promise.resolve();
let runtime;
let runtimeState = 'stopped';
let runtimeFiles = new Map();
let booting = false;
let busy = false;
let awaitingReload = false;
let reloadWatch;
let startupWatch;
let playGeneration = 0;
let reloadFromError = false;
let errorInReload = false;
let allowLeave = false;
let focusAfterStart = false;
const editorStates = new Map();
const collapsed = new Set();
const workspace = new WorkspaceLayout(() => remember());
const bridge = new PlayerBridge(handleRuntime);

function icon(id) {
  return $(id).content.cloneNode(true);
}

function log(message, level = 'info', source) {
  $('.pg-console-welcome')?.remove();
  const row = document.createElement('p');
  row.className = 'pg-log ' + level;
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('en', { hour12: false });
  row.append(time);
  if (source && project.files.has(source.path)) {
    const link = document.createElement('button');
    link.textContent = message;
    link.addEventListener('click', () => {
      openFile(source.path);
      jumpTo(source.line);
    });
    row.append(link);
  } else row.append(document.createTextNode(message));
  $('#console').append(row);
  while ($('#console').children.length > 200) $('#console').firstElementChild.remove();
  $('#console-count').textContent = $('#console').children.length;
  $('#console').scrollTop = $('#console').scrollHeight;
}
$('#clear-console').addEventListener('click', () => {
  $('#console').replaceChildren();
  $('#console-count').textContent = '0';
});

function updateProjectName() {
  try {
    $('#project-name').textContent = JSON.parse(project.text('app.json')).name || 'Untitled project';
  } catch {
    $('#project-name').textContent = 'Your project';
  }
}
function remember() {
  saveRevision++;
  clearTimeout(saveTimer);
  $('#save-status').textContent = 'Saving…';
  $('#dirty-mark').hidden = !active;
  saveTimer = setTimeout(saveNow, 650);
}
function saveNow() {
  clearTimeout(saveTimer);
  const revision = saveRevision;
  const snapshot = {
    files: [...project.files],
    folders: [...project.folders],
    active,
    hotReload: $('#hot-reload').checked,
    layout: { ...workspace.state },
    collapsed: [...collapsed],
  };
  saving = saving
    .catch(() => {})
    .then(async () => {
      if (!db) throw new Error('Your browser could not save this project. Use Export ZIP to keep a copy.');
      await storage(db, 'save', snapshot);
      savedRevision = revision;
      if (revision === saveRevision) {
        $('#save-status').textContent = 'Saved on this device';
        $('#dirty-mark').hidden = true;
      }
    })
    .catch((error) => {
      $('#save-status').textContent = 'Could not save — export ZIP';
      status(error.message);
    });
  return saving;
}
window.addEventListener('beforeunload', (event) => {
  if (!allowLeave && savedRevision !== saveRevision) {
    event.preventDefault();
    event.returnValue = '';
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && saveRevision !== savedRevision) saveNow();
});

const theme = EditorView.theme(
  {
    '&': { color: '#c8d7ea', backgroundColor: '#0d131d' },
    '.cm-content': { caretColor: '#9dafff' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#162333' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: '#334575 !important',
    },
    '.cm-cursor': { borderLeftColor: '#9dafff' },
    '.cm-panels, .cm-tooltip': { backgroundColor: '#141720', color: '#e2e6f1', borderColor: '#2b3040' },
  },
  { dark: true },
);
const highlights = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.keyword, color: '#c4a3ed' },
    { tag: tags.string, color: '#a8cfb6' },
    { tag: tags.comment, color: '#6c819b', fontStyle: 'italic' },
    { tag: tags.number, color: '#e6b986' },
    { tag: tags.function(tags.variableName), color: '#91baff' },
    { tag: tags.operator, color: '#c6a8eb' },
    { tag: tags.propertyName, color: '#91c6e5' },
    { tag: tags.bool, color: '#dcacdf' },
  ]),
);
function language(path) {
  path = path.toLowerCase();
  if (path.endsWith('.lua')) return StreamLanguage.define(lua);
  if (path.endsWith('.json')) return [json(), linter(jsonParseLinter())];
  if (/\.(js|ts)$/.test(path)) return StreamLanguage.define(javascript);
  if (/\.(svg|xml|html)$/.test(path)) return StreamLanguage.define(xml);
  if (path.endsWith('.css')) return StreamLanguage.define(css);
  return [];
}
function makeState(path) {
  return EditorState.create({
    doc: project.text(path),
    extensions: [
      basicSetup,
      search({ createPanel: (view) => new SearchPanel(view), top: true }),
      theme,
      highlights,
      language(path),
      EditorState.tabSize.of(4),
      EditorState.changeFilter.of((transaction) => {
        if (
          transaction.newDoc.length * 3 <= 1024 * 1024 ||
          encoder.encode(transaction.newDoc.toString()).length <= 1024 * 1024
        )
          return true;
        status('This file is too large to edit here. Choose a text file smaller than 1 MB.');
        return false;
      }),
      EditorView.contentAttributes.of({ 'aria-label': `Code for ${path}`, spellcheck: 'false' }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          try {
            project.import([[active, encoder.encode(update.state.doc.toString())]]);
            editorStates.set(active, update.state);
            remember();
            queueChanges();
            if (active === 'app.json') updateProjectName();
            showSize();
          } catch (error) {
            status(error.message + ' Export a backup before continuing.');
          }
        }
        if (update.selectionSet || update.docChanged) cursorPosition();
      }),
    ],
  });
}
function cursorPosition() {
  if (!view) return;
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  $('#cursor-position').textContent = `Ln ${line.number}, Col ${head - line.from + 1}`;
}
function showSize() {
  $('#file-size').textContent = ` · ${((project.files.get(active)?.length || 0) / 1024).toFixed(1)} KB`;
}
function jumpTo(number = 1) {
  if (!view || !isText(active)) return;
  const line = view.state.doc.line(Math.max(1, Math.min(Number(number) || 1, view.state.doc.lines)));
  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
  });
  view.focus();
}
function closeFile(persist = true) {
  if (active && view) editorStates.set(active, view.state);
  view?.destroy();
  view = undefined;
  if (assetUrl) URL.revokeObjectURL(assetUrl);
  assetUrl = undefined;
  active = '';
  $('#active-file').textContent = 'No file open';
  $('#language-label').textContent = '';
  $('#code-editor').hidden = true;
  $('#asset-preview').hidden = true;
  $('#empty-editor').hidden = false;
  $('#editor-status').hidden = true;
  $('#close-file').disabled = true;
  $('#dirty-mark').hidden = true;
  renderTree();
  if (persist) remember();
}
$('#close-file').addEventListener('click', () => closeFile());
document.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey) || document.querySelector('dialog[open]')) return;
  if (event.key.toLowerCase() === 'b') {
    event.preventDefault();
    workspace.toggle('files');
  }
  if (event.key.toLowerCase() === 'w' && active) {
    event.preventDefault();
    closeFile();
  }
});
function openFile(path, switchPane = true) {
  if (!project.files.has(path)) return;
  if (active && view && !$('#code-editor').hidden) editorStates.set(active, view.state);
  active = selected = path;
  $('#empty-editor').hidden = true;
  $('#editor-status').hidden = false;
  $('#close-file').disabled = false;
  $('#active-file').textContent = path;
  $('#language-label').textContent = path.split('.').pop().toUpperCase();
  if (assetUrl) {
    URL.revokeObjectURL(assetUrl);
    assetUrl = undefined;
  }
  const text = isText(path) && project.files.get(path).length <= 1024 * 1024;
  $('#code-editor').hidden = !text;
  $('#asset-preview').hidden = text;
  if (text) {
    const state = editorStates.get(path) || makeState(path);
    if (view) view.setState(state);
    else view = new EditorView({ state, parent: $('#code-editor') });
    cursorPosition();
  } else {
    const preview = $('#asset-preview');
    preview.replaceChildren();
    const mime = {
      svg: 'image/svg+xml',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
    }[path.split('.').pop().toLowerCase()];
    assetUrl = URL.createObjectURL(
      new Blob([project.files.get(path)], { type: mime || 'application/octet-stream' }),
    );
    if (mime) {
      const image = document.createElement('img');
      image.src = assetUrl;
      image.alt = path;
      preview.append(image);
    }
    const label = document.createElement('p');
    label.textContent = isText(path) ? 'This file is too large to edit here (1 MB limit).' : path;
    preview.append(label);
    const download = document.createElement('a');
    download.href = assetUrl;
    download.download = path.split('/').pop();
    download.className = 'pg-button';
    download.textContent = 'Download file';
    preview.append(download);
  }
  showSize();
  renderTree();
  if (switchPane) workspace.show('code');
}
function renderTree() {
  const tree = $('#file-tree');
  const focused = tree.contains(document.activeElement) ? document.activeElement?.dataset.path : null;
  tree.replaceChildren();
  function branch(parent, target, depth) {
    const entries = [...project.folders]
      .map((path) => [path, true])
      .concat([...project.files.keys()].map((path) => [path, false]))
      .filter(([path]) => path.split('/').slice(0, -1).join('/') === parent)
      .sort(([a, da], [b, db]) => Number(db) - Number(da) || a.localeCompare(b));
    for (const [path, folder] of entries) {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('role', 'none');
      const button = document.createElement('button');
      button.className = 'pg-tree-row';
      button.dataset.path = path;
      button.setAttribute('role', 'treeitem');
      button.setAttribute('aria-level', depth + 1);
      button.setAttribute('aria-selected', String(path === selected));
      button.style.paddingLeft = `${6 + depth * 13}px`;
      if (folder) {
        button.append(icon('#chevron-icon'));
        button.setAttribute('aria-expanded', String(!collapsed.has(path)));
      } else button.style.paddingLeft = `${23 + depth * 13}px`;
      button.append(icon(folder ? '#folder-icon' : '#file-icon'));
      const name = document.createElement('span');
      name.textContent = path.split('/').pop();
      button.append(name);
      button.title = path;
      button.addEventListener('click', () => {
        selected = path;
        if (folder) {
          if (collapsed.has(path)) collapsed.delete(path);
          else collapsed.add(path);
          renderTree();
          tree.querySelectorAll('button').forEach((b) => {
            if (b.dataset.path === path) b.focus();
          });
        } else openFile(path);
      });
      wrapper.append(button);
      target.append(wrapper);
      if (folder) {
        const group = document.createElement('div');
        group.setAttribute('role', 'group');
        group.hidden = collapsed.has(path);
        wrapper.append(group);
        branch(path, group, depth + 1);
      }
    }
  }
  branch('', tree, 0);
  const buttons = [...tree.querySelectorAll('button')].filter((button) => !button.closest('[hidden]'));
  for (const button of buttons) button.tabIndex = button.dataset.path === (focused || selected) ? 0 : -1;
  if (!buttons.some((button) => button.tabIndex === 0) && buttons[0]) buttons[0].tabIndex = 0;
  if (focused) buttons.find((button) => button.dataset.path === focused)?.focus();
  $('#rename-item').disabled = $('#delete-item').disabled = !project.has(selected);
}
$('#file-tree').addEventListener('keydown', (event) => {
  const buttons = [...$('#file-tree').querySelectorAll('button')].filter((b) => !b.closest('[hidden]'));
  const index = buttons.indexOf(document.activeElement);
  if (index < 0) return;
  let next;
  if (event.key === 'ArrowDown') next = buttons[Math.min(index + 1, buttons.length - 1)];
  if (event.key === 'ArrowUp') next = buttons[Math.max(0, index - 1)];
  if (event.key === 'Home') next = buttons[0];
  if (event.key === 'End') next = buttons.at(-1);
  if (next) {
    event.preventDefault();
    buttons[index].tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  }
  if (event.key === 'ArrowRight' && document.activeElement.getAttribute('aria-expanded') === 'false') {
    event.preventDefault();
    document.activeElement.click();
  }
  if (event.key === 'ArrowLeft') {
    if (document.activeElement.getAttribute('aria-expanded') === 'true') document.activeElement.click();
    else {
      const parent = document.activeElement.dataset.path.split('/').slice(0, -1).join('/');
      buttons.find((b) => b.dataset.path === parent)?.focus();
    }
    event.preventDefault();
  }
  if (event.key === 'F2') {
    event.preventDefault();
    rename();
  }
});

let dialogResolve;
let dialogValidate;
function ask(title, description, value, submit = 'Save', validate) {
  if (dialogResolve) return Promise.resolve(null);
  notices.clear();
  dialogValidate = validate;
  $('#path-input').removeAttribute('aria-invalid');
  $('#dialog-title').textContent = title;
  $('#dialog-description').textContent = description;
  $('#path-input').hidden = $('#path-label').hidden = value === null;
  $('#path-input').required = value !== null;
  $('#path-input').value = value || '';
  $('#dialog-submit').textContent = submit;
  $('#dialog-error').textContent = '';
  $('#action-dialog').showModal();
  if (value !== null) {
    $('#path-input').focus();
    $('#path-input').select();
  }
  return new Promise((resolve) => {
    dialogResolve = resolve;
  });
}
function finishDialog(value) {
  const resolve = dialogResolve;
  dialogResolve = undefined;
  $('#action-dialog').close();
  resolve?.(value);
}
$('#action-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = $('#path-input').hidden ? true : $('#path-input').value;
  try {
    dialogValidate?.(value);
    finishDialog(value);
  } catch (error) {
    $('#dialog-error').textContent = error.message;
    $('#path-input').setAttribute('aria-invalid', 'true');
    $('#path-input').focus();
  }
});
$('#dialog-cancel').addEventListener('click', () => finishDialog(null));
$('#action-dialog').addEventListener('close', () => {
  if ($('#action-dialog').open) return;
  const resolve = dialogResolve;
  dialogResolve = undefined;
  dialogValidate = undefined;
  $('#action-dialog').returnValue = '';
  resolve?.(null);
});
$('#path-input').addEventListener('input', () => {
  $('#dialog-error').textContent = '';
  $('#path-input').removeAttribute('aria-invalid');
});
const selectedFolder = () =>
  project.folders.has(selected) ? selected : selected.split('/').slice(0, -1).join('/');
$('#back-home').addEventListener('click', async (event) => {
  event.preventDefault();
  await saveNow();
  const description =
    savedRevision === saveRevision
      ? 'Your project is saved in this browser. Leave the editor and return to the Haylen home page?'
      : 'The latest changes could not be saved. Export a ZIP to keep your work before leaving.';
  if (!(await ask('Leave the playground?', description, null, 'Back to Home'))) return;
  allowLeave = true;
  location.assign($('#back-home').href);
});
async function addItem(folder) {
  const base = selectedFolder();
  const name = await ask(
    folder ? 'New folder' : 'New file',
    'Enter a name. To put it in a folder, use a name such as source/player.lua.',
    (base ? base + '/' : '') + (folder ? 'new-folder' : 'untitled.lua'),
    'Save',
    (value) => project.fork().add(value, folder),
  );
  if (!name) return;
  try {
    const path = cleanPath(name);
    project.add(path, folder);
    selected = path;
    if (folder) renderTree();
    else openFile(path);
    status('');
    remember();
    queueChanges();
  } catch (error) {
    status(error.message);
  }
}
async function rename() {
  const from = selected;
  if (!project.has(from)) return;
  const requested = await ask(
    'Rename or move',
    'Change the name or folder. If your code uses the old name, update it there too.',
    from,
    'Save',
    (value) => {
      if (value !== from) project.fork().move(from, value);
    },
  );
  if (!requested || requested === from) return;
  try {
    const to = cleanPath(requested);
    project.move(from, to);
    editorStates.clear();
    const oldActive = active;
    active = '';
    selected = to;
    const next =
      oldActive === from || oldActive.startsWith(from + '/') ? to + oldActive.slice(from.length) : oldActive;
    if (project.files.has(next)) openFile(next, false);
    else renderTree();
    remember();
    queueChanges();
  } catch (error) {
    status(error.message);
  }
}
$('#new-file').addEventListener('click', () => addItem(false));
$('#new-folder').addEventListener('click', () => addItem(true));
$('#rename-item').addEventListener('click', rename);
$('#delete-item').addEventListener('click', async () => {
  const path = selected;
  if (
    !project.has(path) ||
    !(await ask(
      'Delete this item?',
      `${path}${project.folders.has(path) ? ' and everything inside it' : ''} will be removed. Export a ZIP first if you need a backup.`,
      null,
      'Delete',
    ))
  )
    return;
  project.remove(path);
  editorStates.clear();
  selected = '';
  const next = project.files.has(active) ? active : null;
  active = '';
  if (next) openFile(next, false);
  else closeFile(false);
  remember();
  queueChanges();
});

function setBusy(value) {
  busy = value;
  $('#import-button').disabled = value;
  $('#export-button').disabled = value;
  $('#reset-button').disabled = value;
  setRuntimeState(runtimeState);
}

function setRuntimeState(state) {
  runtimeState = state;
  $('#runtime-state').textContent = {
    stopped: 'Stopped',
    loading: 'Starting…',
    running: 'Running',
    paused: 'Paused',
    error: 'Check your code',
    fatal: 'Restart needed',
  }[state];
  $('#play').disabled = !runtimeAvailable || state === 'loading' || busy;
  $('#pause').disabled = !['running', 'paused'].includes(state);
  $('#pause span').textContent = state === 'paused' ? 'Resume' : 'Pause';
  $('#stop').disabled = !['loading', 'running', 'paused', 'error'].includes(state);
}
const post = (type, detail = {}) => bridge.post(type, detail);
function expandPreview(expanded) {
  const panel = $('.pg-output');
  panel.classList.toggle('is-expanded', expanded);
  panel.setAttribute('role', expanded ? 'dialog' : 'region');
  if (expanded) panel.setAttribute('aria-modal', 'true');
  else panel.removeAttribute('aria-modal');
  const button = $('#expand-preview');
  button.setAttribute('aria-label', expanded ? 'Restore editor layout' : 'Expand preview');
  button.title = button.getAttribute('aria-label');
  button.setAttribute('aria-pressed', String(expanded));
  for (const selector of ['.pg-heading', '.pg-toolbar', '.pg-activity', '.pg-files', '.pg-code'])
    $(selector).inert = expanded;
  workspace.render();
  button.focus();
}
$('#expand-preview').addEventListener('click', () =>
  expandPreview(!$('.pg-output').classList.contains('is-expanded')),
);
document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    $('.pg-output').classList.contains('is-expanded') &&
    !document.querySelector('dialog[open]')
  )
    expandPreview(false);
});
function validateProject() {
  if (!project.files.has('app.json') || !project.files.has('source/main.lua'))
    throw new Error(
      'Check your project files: place app.json at the top level and main.lua inside the source folder.',
    );
  JSON.parse(project.text('app.json'));
}
async function play(fresh = false) {
  if (!runtimeAvailable || booting || busy) return;
  if (runtimeState === 'paused' && !fresh) {
    post('resume');
    return;
  }
  const generation = ++playGeneration;
  focusAfterStart = !$('#code-editor').contains(document.activeElement);
  try {
    validateProject();
    status('');
    booting = true;
    bridge.destroy();
    runtime = undefined;
    setRuntimeState('loading');
    await saveNow();
    if (generation !== playGeneration) return;
    clearTimeout(hotTimer);
    awaitingReload = false;
    clearTimeout(reloadWatch);
    runtimeFiles = new Map(project.files);
    const bytes = await pack(project);
    if (generation !== playGeneration) return;
    if (matchMedia('(max-width: 1100px)').matches && focusAfterStart) workspace.show('preview');
    runtime = bridge.start(bytes, $('#preview-screen'));
    if (focusAfterStart) runtime.focus();
    $('#preview-cover').hidden = true;
    clearTimeout(startupWatch);
    startupWatch = setTimeout(() => {
      booting = false;
      setRuntimeState('fatal');
      log('The project did not start. Use Play to restart the preview.', 'error');
    }, 30000);
  } catch (error) {
    booting = false;
    setRuntimeState('fatal');
    log(error.message, 'error');
  }
}
function queueChanges() {
  clearTimeout(hotTimer);
  if (!$('#hot-reload').checked || !runtime || !['running', 'paused', 'error'].includes(runtimeState)) return;
  hotTimer = setTimeout(applyChanges, 700);
}
function applyChanges() {
  if (!runtime || !$('#hot-reload').checked || !['running', 'paused', 'error'].includes(runtimeState)) return;
  if (awaitingReload) {
    queueChanges();
    return;
  }
  const files = [...project.files].filter(([path, bytes]) => runtimeFiles.get(path) !== bytes);
  const removed = [...runtimeFiles.keys()].filter((path) => !project.files.has(path));
  if (!files.length && !removed.length) return;
  // These changes require a fresh app. Recreate the host as well, avoiding stale
  // audio/context work from a previous app in the WebKit player.
  if (
    files.some(
      ([path]) => path === 'app.json' || path === 'source/main.lua' || /\.(ttf|otf|ttc)$/.test(path),
    ) ||
    removed.some((path) => path.endsWith('.lua'))
  ) {
    play(true);
    return;
  }
  awaitingReload = true;
  reloadFromError = runtimeState === 'error';
  errorInReload = false;
  runtimeFiles = new Map(project.files);
  post('changes', { files, removed });
  reloadWatch = setTimeout(() => {
    awaitingReload = false;
    log('Your changes have not appeared yet. Press Play to restart the preview.', 'warning');
  }, 6000);
}
function handleRuntime({ type, detail }) {
  if (type === 'escape' && $('.pg-output').classList.contains('is-expanded')) expandPreview(false);
  if (type === 'started') {
    clearTimeout(startupWatch);
    booting = false;
    if (['error', 'fatal'].includes(runtimeState)) return;
    setRuntimeState('running');
    log(`Running ${detail.name || 'your project'}.`, 'success');
    queueChanges();
  }
  if (type === 'stopped') {
    clearTimeout(startupWatch);
    booting = false;
    setRuntimeState('stopped');
    bridge.destroy();
    runtime = undefined;
    $('#preview-cover').hidden = false;
  }
  if (type === 'paused') setRuntimeState('paused');
  if (type === 'resumed') setRuntimeState('running');
  if (type === 'log') log(detail.line, detail.level);
  if (type === 'stats')
    $('#render-stats').textContent = `${Math.round(detail.fps)} FPS · ${detail.drawCalls} draws`;
  if (type === 'error' || type === 'fatal') {
    if (awaitingReload) errorInReload = true;
    clearTimeout(startupWatch);
    booting = false;
    awaitingReload = false;
    clearTimeout(reloadWatch);
    setRuntimeState(type === 'fatal' ? 'fatal' : 'error');
    const path = String(detail.file || '')
      .replace(/^@/, '')
      .replace(/^\/?app\//, '');
    log(detail.message || 'The project reported an error.', 'error', { path, line: detail.line });
    if (detail.traceback) log(detail.traceback, 'error');
    if (path === active && view && isText(active)) {
      const line = view.state.doc.line(Math.max(1, Math.min(Number(detail.line) || 1, view.state.doc.lines)));
      view.dispatch(
        setDiagnostics(view.state, [
          { from: line.from, to: line.to, severity: 'error', message: detail.message },
        ]),
      );
    }
  }
  if (type === 'reloaded') {
    awaitingReload = false;
    clearTimeout(reloadWatch);
    log(
      detail.restarted ? 'Restarting the preview to apply your changes.' : 'Changes applied to the preview.',
      'success',
    );
    if (!detail.restarted && runtimeState === 'error' && detail.resumed) setRuntimeState('running');
    // Returning to the last successful module bytes can produce an empty report
    // while the upstream player still holds its old error. A fresh Run recovers.
    if (
      reloadFromError &&
      !errorInReload &&
      runtimeState === 'error' &&
      !detail.restarted &&
      !detail.resumed &&
      !detail.modules?.length &&
      !detail.assets?.length
    ) {
      reloadFromError = false;
      log('Restarting the project after restoring the last working code.', 'info');
      play();
    }
    if (view) view.dispatch(setDiagnostics(view.state, []));
    queueChanges();
  }
}
$('#play').addEventListener('click', () => play());
$('#preview-play').addEventListener('click', () => play());
$('#pause').addEventListener('click', () => post(runtimeState === 'paused' ? 'resume' : 'pause'));
$('#stop').addEventListener('click', () => {
  clearTimeout(hotTimer);
  clearTimeout(startupWatch);
  playGeneration++;
  bridge.destroy();
  runtime = undefined;
  booting = false;
  setRuntimeState('stopped');
  $('#preview-cover').hidden = false;
});
$('#restart-preview').addEventListener('click', () => play(true));
$('#hot-reload').addEventListener('change', () => {
  remember();
  queueChanges();
});

function replaceProject(next, path = 'source/main.lua') {
  playGeneration++;
  bridge.destroy();
  runtime = undefined;
  booting = false;
  awaitingReload = false;
  clearTimeout(reloadWatch);
  clearTimeout(hotTimer);
  clearTimeout(startupWatch);
  project = next;
  active = '';
  selected = '';
  editorStates.clear();
  collapsed.clear();
  for (const folder of project.folders) {
    if (folder.includes('/')) collapsed.add(folder);
  }
  setRuntimeState('stopped');
  $('#preview-cover').hidden = false;
  updateProjectName();
  openFile(project.files.has(path) ? path : project.files.keys().next().value, false);
  remember();
}
async function chooseExample(example) {
  $('#examples-dialog').close();
  if (
    !(await ask(
      `Load ${example.name}?`,
      'This replaces all your current files. Use Export ZIP first to keep a copy.',
      null,
      'Load example',
    ))
  )
    return;
  setBusy(true);
  try {
    const next = await examples.load(example.id);
    replaceProject(next);
    await saveNow();
    status(`${example.name} loaded.`);
  } catch (error) {
    status(error.message);
  } finally {
    setBusy(false);
  }
}

$('#reset-button').addEventListener('click', async () => {
  if (busy) return;
  const request = ++exampleRequest;
  const dialog = $('#examples-dialog');
  const list = $('#example-list');
  list.replaceChildren();
  $('#example-status').textContent = 'Loading examples…';
  dialog.showModal();
  try {
    const catalog = await examples.catalog();
    if (!dialog.open || request !== exampleRequest) return;
    for (const example of catalog.projects) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pg-example';
      button.setAttribute('aria-label', `Load ${example.name}`);
      const image = document.createElement('img');
      image.src = `./${example.directory}/${example.preview}`;
      image.alt = '';
      image.width = 420;
      image.height = 210;
      button.append(image);
      for (const [className, value] of [
        ['pg-example-category', example.category],
        ['pg-example-name', example.name],
        ['pg-example-description', example.description],
      ]) {
        const text = document.createElement('span');
        text.className = className;
        text.textContent = value;
        button.append(text);
      }
      button.addEventListener('click', () => chooseExample(example));
      list.append(button);
    }
    $('#example-status').textContent = '';
  } catch (error) {
    $('#example-status').textContent = error.message;
  }
});
$('#close-examples').addEventListener('click', () => $('#examples-dialog').close());
$('#export-button').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  $('#export-button').disabled = true;
  try {
    await saveNow();
    const bytes = await pack(project);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      ($('#project-name')
        .textContent.toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') || 'haylen-project') + '.zip';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status('Project downloaded. Keep the ZIP as a backup.');
  } catch (error) {
    status(error.message);
  } finally {
    setBusy(false);
    $('#export-button').disabled = false;
  }
});
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#close-help').addEventListener('click', () => $('#help-dialog').close());
$('#import-button').addEventListener('click', () => $('#import-dialog').showModal());
$('#close-import').addEventListener('click', () => $('#import-dialog').close());
$('#choose-files').addEventListener('click', () => {
  $('#import-dialog').close();
  $('#file-import').click();
});
$('#choose-folder').addEventListener('click', () => {
  $('#import-dialog').close();
  $('#folder-import').click();
});

async function importFiles(items) {
  if (busy || !items.length) return;
  setBusy(true);
  try {
    if (items.length === 1 && !items[0].folder && /\.zip$/i.test(items[0].path)) {
      if (items[0].file.size > limits.bytes)
        throw new Error('This ZIP is too large. Choose one smaller than 64 MB.');
      const next = await unpack(new Uint8Array(await items[0].file.arrayBuffer()));
      if (
        await ask(
          'Open this project?',
          'This ZIP will replace the current project. Export a backup first if you want to keep your work.',
          null,
          'Open project',
        )
      ) {
        replaceProject(next);
        log('Project opened.', 'success');
      }
    } else {
      const base = selectedFolder();
      let total = 0;
      if (items.length > limits.files) throw new Error('Choose up to 1,000 files and folders at a time.');
      for (const { path, file, folder } of items) {
        cleanPath((base ? base + '/' : '') + path);
        if (folder) continue;
        if (file.size > limits.fileBytes || (total += file.size) > limits.bytes)
          throw new Error(
            `Could not add ${path}. Each file can be up to 16 MB, and the whole project up to 64 MB.`,
          );
      }
      const entries = await Promise.all(
        items
          .filter((item) => !item.folder)
          .map(async ({ path, file }) => [
            cleanPath((base ? base + '/' : '') + path),
            new Uint8Array(await file.arrayBuffer()),
          ]),
      );
      const folders = items
        .filter((item) => item.folder)
        .map(({ path }) => cleanPath((base ? base + '/' : '') + path));
      const next = project.fork();
      next.import(entries, folders);
      const overwrite = entries.filter(([path]) => project.files.has(path));
      if (
        overwrite.length &&
        !(await ask(
          'Replace existing files?',
          `${overwrite.length} files already exist in ${base || 'the main folder'}. Their contents will be replaced.`,
          null,
          'Replace files',
        ))
      )
        return;
      const previous = active;
      project = next;
      editorStates.clear();
      active = '';
      if (entries.length) openFile(entries[0][0]);
      else if (project.files.has(previous)) openFile(previous, false);
      else renderTree();
      updateProjectName();
      remember();
      queueChanges();
      log(`Imported ${entries.length} files into ${base || 'the main folder'}.`, 'success');
      status('Files added to your project.');
    }
  } catch (error) {
    status(error.message);
    log(error.message, 'error');
  } finally {
    setBusy(false);
  }
}
for (const id of ['#file-import', '#folder-import'])
  $(id).addEventListener('change', async (event) => {
    const files = [...event.target.files];
    await importFiles(files.map((file) => ({ path: file.webkitRelativePath || file.name, file })));
    event.target.value = '';
  });
async function readEntry(entry, prefix = '') {
  cleanPath(prefix + entry.name);
  if (entry.isFile)
    return [
      {
        path: prefix + entry.name,
        file: await new Promise((resolve, reject) => entry.file(resolve, reject)),
      },
    ];
  const reader = entry.createReader();
  const children = [];
  let batch;
  do {
    batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    children.push(...batch);
    if (children.length > limits.files) throw new Error('Choose up to 1,000 files and folders at a time.');
  } while (batch.length);
  const result = [{ path: prefix + entry.name, folder: true }];
  for (const child of children) {
    result.push(...(await readEntry(child, prefix + entry.name + '/')));
    if (result.length > limits.files) throw new Error('Choose up to 1,000 files and folders at a time.');
  }
  return result;
}
const filesPane = $('.pg-files');
let dragDepth = 0;
filesPane.addEventListener('dragenter', (event) => {
  if (event.dataTransfer.types.includes('Files')) {
    event.preventDefault();
    dragDepth++;
    filesPane.classList.add('is-dragging');
  }
});
filesPane.addEventListener('dragover', (event) => {
  if (event.dataTransfer.types.includes('Files')) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }
});
filesPane.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) filesPane.classList.remove('is-dragging');
});
filesPane.addEventListener('drop', async (event) => {
  event.preventDefault();
  dragDepth = 0;
  filesPane.classList.remove('is-dragging');
  // Capture browser-owned entry handles synchronously, before the drop event ends.
  const entries = [...event.dataTransfer.items].map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  const fallback = [...event.dataTransfer.files].map((file) => ({ path: file.name, file }));
  try {
    const items = [];
    for (const entry of entries) items.push(...(await readEntry(entry)));
    await importFiles(entries.length ? items : fallback);
  } catch (error) {
    status(error.message);
  }
});
window.addEventListener('dragover', (event) => {
  if (event.dataTransfer.types.includes('Files')) event.preventDefault();
});
window.addEventListener('drop', (event) => event.preventDefault());

const offline = new OfflineCache({
  notify: status,
  beforeUpdate: async () => {
    await saveNow();
    if (!db || savedRevision !== saveRevision) return false;
    bridge.destroy();
    allowLeave = true;
    return true;
  },
});

const buildTime = $('#build-time');
buildTime.title = `Built ${new Date(buildTime.dateTime).toUTCString()}. The date below uses your local time.`;
buildTime.textContent = new Date(buildTime.dateTime).toLocaleString(undefined, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
async function init() {
  try {
    let saved;
    try {
      db = await openDatabase();
      saved = await storage(db, 'load');
    } catch {
      status('Your browser could not save this project. Use Export ZIP to keep a copy.');
    }
    if (saved) {
      project = new Project(saved.files, saved.folders);
      $('#hot-reload').checked = saved.hotReload !== false;
      workspace.restore(saved.layout);
      for (const folder of saved.collapsed || []) collapsed.add(folder);
      updateProjectName();
      const path =
        saved.active === ''
          ? null
          : project.files.has(saved.active)
            ? saved.active
            : project.files.keys().next().value;
      if (path) openFile(path, false);
      else closeFile(false);
      $('#save-status').textContent = 'Saved project opened';
    } else {
      replaceProject(await examples.load());
      await saveNow();
    }
    setRuntimeState('stopped');
    if (!runtimeAvailable) {
      $('#preview-play').disabled = true;
      $('#offline-status').textContent = 'Preview unavailable';
      status(
        'You can edit files and download your project, but the preview is unavailable in this version of the playground.',
      );
    } else offline.start();
  } catch (error) {
    status(error.message);
    log(error.message, 'error');
    $('#save-status').textContent = 'Could not open project';
  }
}
init();
