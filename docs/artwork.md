# Identity, illustrations and icons

## Playground

Action Game uses the unchanged warrior, archer, mage, imp, brute, portrait and effect atlases from [Haylen's Tiny Island sample](https://github.com/haylen-org/haylen/tree/main/samples/games/tiny-island/content). Those original Haylen assets were created with imagegen. Their required MIT copyright notice is preserved with the website notice in the starter's `LICENSE.txt`. The forest panorama, terrain/prop sheet and continuous ground/bridge textures under `src/public/playground/starter/content/art/` were generated with the built-in imagegen tool, using the official heroes as style references: medieval cartoon fantasy, bold outlines and clean cel shading, without pixel art. Final PNG files are unchanged. The starter contains its game files and the required license notice. Provenance stays in this document.

`source/art.lua` owns source rectangles and linear-filtered textures. `sprites.lua` uses Haylen's native frame animation API. `ground.png` and `bridge.png` are complete continuous strips. Native nine-slices preserve their end caps and fill the requested width without repeating end borders or disconnected arches. Their generation briefs specify a side-view medieval cartoon strip, a flat walking edge, no internal end-cap outlines and a transparent background. No raster processing is applied to the delivered PNGs. The physics mover, Box2D world, swept projectile ray casts, crate impulses and particle emitters are actual engine features. These assets are game sources, not engine screenshots. Website and game captures must come from the real browser runtime.

Weapon attachments live in `heroes.lua`, measured in each original untrimmed attack frame. `sprites.lua` adds native muzzle points and a release event to the attack animation without changing the original atlas files. It preserves the artwork's trim through explicit frame pivots and mirrors attachments with the sprite. A released shot is drawn at that frame's attachment before its first physics step. Projectile drawing anchors the arrow at the bow crossing and the magic effect at its painted bright core.

The locally bundled CodeMirror editor, its language/highlight dependencies and fflate include their MIT notices in `dist/licenses/playground.txt`. esbuild also emits retained bundle notices. These packages do not load fonts, scripts or assets from a CDN.

The official Haylen symbol and wordmark are copied unchanged from [`haylen-org/haylen/extras/images`](https://github.com/haylen-org/haylen/tree/main/extras/images):

- `symbol.svg` → `src/public/favicon.svg`, also reused as the Home and About mark.
- `logo-h-dark.svg` → `src/public/assets/brand/logo.svg`.

The Home feature illustrations in `src/public/assets/features/` are original, editable technical SVG diagrams with a shared drawing scale, type hierarchy and restrained brand palette. They show a 2D sprite/light/frame composition, responsive interface constraints, joints and collision normals, named input bindings, the Lua/native plugin boundary and the edit/reload workflow. Static `<picture>` sources select dedicated `-small.svg` compositions on phones, with larger labels and simpler arrangements. These are authored vector diagrams, not imagegen artwork, engine screenshots or benchmark results. The separate `plugin-bridge.svg` remains the About architecture diagram. The Home's code example uses actual Haylen scene and graphics APIs.

The Web demos images are real browser captures of the corresponding Haylen WebAssembly projects. Files are named `<category>-<sample>-preview.png`, with `tests-preview.png` for the engine test app. Their authoritative references are the `image` fields in `src/data/samples.json`. Sample images appear only on Web demos. They are reviewed snapshots and may need to be refreshed when upstream sample interfaces change.

UI icons use [Lucide Static](https://lucide.dev/guide/static), distributed under the ISC license. Platform and GitHub marks use [Font Awesome Free Brands](https://github.com/FortAwesome/Font-Awesome), with its package license retained. `scripts/icons.mjs` embeds only selected icons as inline SVG during the Node build; no icon font, CDN or icon-library JavaScript is loaded by the browser. License notices are included in `dist/licenses/`.

The hero is authored HTML, SVG and CSS. Its orbital paths, light trails and halos frame the unchanged, static official symbol. Ambient lights drift slowly and the orbits rotate continuously. The same CSS animations pause offscreen or in hidden tabs and resume when the hero becomes visible, including after history navigation. It has no animation controls, animation library, raster animation or WebGL context. The scene stays static with reduced motion or without JavaScript. The social preview is a 1200 × 630 browser capture of the Home hero, with the layout fitted to that share-card size and motion stopped. The unchanged Haylen MIT license is distributed at `src/public/licenses/haylen.txt`.

Capability descriptions follow the [Haylen README](https://github.com/haylen-org/haylen) and [plugin documentation](https://github.com/haylen-org/haylen/blob/main/docs/platform/plugins.md). Haylen supports 2D today; the website does not advertise future 3D work as a current capability.

## Photo Social app example

Photo Social adapts the native [Haylen Photo Social sample](https://github.com/haylen-org/haylen/tree/main/samples/apps/photo-social). Its original twelve cartoon pictures, illustrated avatars, SVG marks, icons, Poppins fonts and UI modules keep the upstream MIT notice and font license. The app uses native retained UI, recycled lists, rounded photo prints and blue/teal accents.

The additional `content/photos/coast.png`, `kyoto.png` and `alps.png` were created with the built-in imagegen tool by restyling the earlier generated landscapes. The edit prompt preserves each composition while replacing photographic textures with dark navy cartoon outlines, rounded shapes, vivid colors and soft two-tone cel shading, without pixel art, UI, text or logos. The scenes show an Amalfi coastal village, a Kyoto garden and an alpine lake. Final generated PNGs are copied unchanged into the project; the app creates display crops and filters through Haylen's native image APIs.
