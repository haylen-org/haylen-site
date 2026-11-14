import { readFile } from 'node:fs/promises';
import {
  faApple,
  faWindows,
  faLinux,
  faAndroid,
  faChrome,
  faGithub,
} from '@fortawesome/free-brands-svg-icons';

const uiIcons = {
  ARROW_RIGHT: 'arrow-right',
  EXTERNAL_LINK: 'arrow-up-right',
  CPU: 'cpu',
  CODE: 'code-xml',
  LAYERS: 'layers',
  GAMEPAD: 'gamepad-2',
  PHYSICS: 'orbit',
  INTERFACE: 'panels-top-left',
  AUDIO: 'audio-lines',
  PLUGINS: 'puzzle',
  PACKAGE: 'package',
  TERMINAL: 'terminal',
  REFRESH: 'refresh-cw',
  SEARCH: 'search',
  BOOK: 'book-open',
  GLOBE: 'globe',
  MONITOR: 'monitor',
  PHONE: 'smartphone',
  TV: 'tv',
  HEADSET: 'glasses',
  CHECK: 'check',
  SHIELD: 'shield-check',
  MOON: 'moon',
  BOXES: 'boxes',
  PLAY: 'play',
  PAUSE: 'pause',
  STOP: 'square',
  FILE: 'file-code-2',
  FILE_PLUS: 'file-plus-2',
  FOLDER: 'folder',
  FOLDER_PLUS: 'folder-plus',
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
  TRASH: 'trash-2',
  CHEVRON: 'chevron-right',
};
const brands = {
  APPLE: faApple,
  WINDOWS: faWindows,
  LINUX: faLinux,
  ANDROID: faAndroid,
  WEB: faChrome,
  GITHUB: faGithub,
};

export async function loadIconTokens() {
  const entries = await Promise.all(
    Object.entries(uiIcons).map(async ([name, filename]) => {
      const asset = new URL(`../node_modules/lucide-static/icons/${filename}.svg`, import.meta.url);
      const svg = (await readFile(asset, 'utf8'))
        .replace(/<!--.*?-->/gs, '')
        .replace(/class="[^"]*"/, `class="icon icon-${filename}"`)
        .replace('<svg', '<svg aria-hidden="true" focusable="false"');
      return [`ICON_${name}`, svg.trim()];
    }),
  );
  for (const [name, definition] of Object.entries(brands)) {
    const [width, height, , , shapes] = definition.icon;
    const paths = (Array.isArray(shapes) ? shapes : [shapes]).map((shape) => `<path d="${shape}"/>`).join('');
    entries.push([
      `ICON_${name}`,
      `<svg class="icon brand-icon" data-icon-library="fontawesome" aria-hidden="true" focusable="false" viewBox="0 0 ${width} ${height}" fill="currentColor">${paths}</svg>`,
    ]);
  }
  return Object.fromEntries(entries);
}
