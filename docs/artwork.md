# Identity, illustrations and icons

The official Haylen symbol and wordmark are copied unchanged from [`haylen-org/haylen/extras/images`](https://github.com/haylen-org/haylen/tree/main/extras/images):

- `symbol.svg` → `src/public/favicon.svg`, also reused as the Home and About mark.
- `logo-h-dark.svg` → `src/public/assets/brand/logo.svg`.

The feature illustrations in `src/public/assets/features/` are original SVG diagrams for rendering, physics, UI, audio/input, plugins and development. They explain engine features; they are not screenshots or benchmark results. The plugin bridge diagram shows the relationship between a Lua API and native implementations.

The Web demos images are real browser captures of the corresponding Haylen WebAssembly projects. Files are named `<category>-<sample>-preview.png`, with `tests-preview.png` for the engine test app. Their authoritative references are the `image` fields in `src/data/samples.json`. Sample images appear only on Web demos. They are reviewed snapshots and may need to be refreshed when upstream sample interfaces change.

UI icons use [Lucide Static](https://lucide.dev/guide/static), distributed under the ISC license. Platform and GitHub marks use [Font Awesome Free Brands](https://github.com/FortAwesome/Font-Awesome), with its package license retained. `scripts/icons.mjs` embeds only selected icons as inline SVG during the Node build; no icon font, CDN or icon-library JavaScript is loaded by the browser. License notices are included in `dist/licenses/`.

The social preview is a browser capture of the current Home page. The unchanged Haylen MIT license is distributed at `src/public/licenses/haylen.txt`.

Capability descriptions follow the [Haylen README](https://github.com/haylen-org/haylen) and [plugin documentation](https://github.com/haylen-org/haylen/blob/main/docs/platform/plugins.md). Haylen supports 2D today; the website does not advertise future 3D work as a current capability.
