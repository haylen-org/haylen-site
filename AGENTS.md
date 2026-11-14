# Haylen website

## Purpose and public content

This repository is the static website for [Haylen](https://github.com/haylen-org/haylen), an open-source C++ and Lua engine for games and apps. It contains Home, About, Demos and a local browser Playground, plus a branded 404 page. Cloudflare Pages hosts the website, editable player and complete compiled WebAssembly sample folders.

Write new public copy in clear, common English. Refer to the language as C++ without a version number in public copy, metadata and artwork. Keep actual toolchain requirements in technical deployment documentation. Explain what a feature does before naming its implementation. Say that Haylen is an engine for 2D games and apps. Describe graphics, physics, UI, audio, input, native plugins and supported platforms with specific examples. Do not add vague slogans, invented benchmarks, unsupported platform claims or claims of production certification. Haylen supports 2D today; future 3D support is not a current feature.

Home presents engine features using original feature illustrations. Do not put sample screenshots, app artwork, sample cards or direct runnable sample links on Home. Keep those on Web demos. About explains the architecture, project structure, plugin system, platform graphics APIs and development workflow.

The README is a short project presentation, with the official mark and useful project links. Keep setup, deployment, troubleshooting and agent rules in their own files. Do not append task logs, old delivery reports or conversational history to project documentation.

## Runtime and architecture

- The website is entirely static HTML, CSS, SVG and browser JavaScript. It has no application server, API, database, framework hydration or deployed Cloudflare Worker.
- Node.js **22.x** is the only website build runtime. `.nvmrc` and `package.json` define it. Use npm and preserve `package-lock.json`.
- Tailwind CSS **4** is built through its local CLI. Do not use a development CDN or introduce Tailwind 3 configuration.
- Python belongs only to the upstream Haylen native compiler. This website has no Python scripts, Pillow, Python site generator or Python test runner.
- Build output, dependencies, native artifacts, temporary sample keys and browser evidence stay outside Git.
- Availability is rendered into HTML at build time. Do not fetch a manifest after load to swap demo state or links.
- Keep initial content visible. Avoid reveal animations, theme flashes, remote font loading or effects that hide the page while JavaScript starts.
- The hero uses CSS/SVG animation without canvas, WebGL or an animation dependency. Keep the official logo intact. Motion starts only when JavaScript enables it, pauses outside the viewport and in hidden tabs, offers a keyboard-accessible pause button and stops for `prefers-reduced-motion`. Never animate layout dimensions or hide content during startup.
- Keep the visual scene, C++/Lua blocks and motion controls in separate grid rows. Reserve the control row before JavaScript starts. Orbital trails must end at their particles and fade behind the direction of travel. Keep all transformed artwork inside its scene at every breakpoint; do not cover buttons or fix overlaps by clipping.

## File map and ownership

| Path                                 | Responsibility                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/layout.html`                    | Shared document shell, metadata, header, navigation and footer.                                                                |
| `src/pages/home.html`                | Engine overview, feature illustrations, plugins, platforms and setup links.                                                    |
| `src/pages/about.html`               | Architecture, native plugins, platform/API table, workflow and license.                                                        |
| `src/pages/demos.html`               | Search/filter UI and the build-rendered sample catalogue.                                                                      |
| `src/pages/playground.html`          | Static editor shell, local project controls, game preview and help dialogs.                                                    |
| `src/playground/`                    | Browser editor, project/ZIP storage, private player bridge, runtime host and scoped styles.                                    |
| `src/public/playground/`             | Native canvas shell and the original editable Skybound starter project.                                                        |
| `scripts/playground.mjs`             | Page-only bundles, complete browser license notices, player injection and offline cache generation.                            |
| `scripts/playground-runtime.mjs`     | Official generic player staging, editable API/WASM checks and provenance.                                                      |
| `tests/playground/`                  | Responsive editor, files, persistence, ZIP, real native runtime and offline browser contracts.                                 |
| `src/data/samples.json`              | The single authoritative catalogue for sample metadata.                                                                        |
| `src/data/site.json`                 | Public site identity, confirmed canonical origin and social image metadata.                                                    |
| `src/tailwind.css`                   | Tailwind imports, explicit source detection and design tokens.                                                                 |
| `src/design.css`                     | Component styles, fixed dark theme, responsive layout, focus and reduced motion.                                               |
| `src/public/favicon.svg`             | Unchanged official Haylen symbol, also reused as the hero mark.                                                                |
| `src/public/assets/brand/logo.svg`   | Unchanged official light wordmark for the dark website.                                                                        |
| `src/public/assets/features/`        | Original SVG illustrations explaining engine feature groups.                                                                   |
| `src/public/assets/samples/`         | Reviewed browser captures of real sample builds; used only on Web demos.                                                       |
| `src/public/assets/main.js`          | Mobile navigation, catalogue filters/URL state and keyboard table scrolling.                                                   |
| `src/public/assets/og-cover.png`     | Social preview of the current Home design.                                                                                     |
| `src/public/licenses/`               | Source asset license notices copied into the public output.                                                                    |
| `scripts/build.mjs`                  | Catalogue validation, static HTML rendering, native folder injection, icon/license rendering, CSS build and deployment limits. |
| `scripts/icons.mjs`                  | Build-time Lucide and Font Awesome SVG rendering. No icon-library browser runtime.                                             |
| `scripts/seo.mjs`                    | HTTPS-origin validation, canonical URLs, structured data and sitemap generation.                                               |
| `scripts/build-web-demos.mjs`        | Upstream sample discovery and orchestration of the real Haylen native compiler.                                                |
| `scripts/demo-artifacts.mjs`         | File traversal, full WASM validation and static-host preload integration.                                                      |
| `tests/site.test.mjs`                | Node integrity, catalogue and packaging contracts, including failure cases.                                                    |
| `tests/browser/site.spec.mjs`        | Real-browser website navigation, filtering, keyboard, image and responsive checks.                                             |
| `tests/browser/demos.spec.mjs`       | Separate-tab native sample startup, frames, input and console/network checks.                                                  |
| `playwright.config.mjs`              | Website browser matrix and Wrangler preview lifecycle.                                                                         |
| `playwright.demos.config.mjs`        | Sequential native runtime checks through Chromium/WebGL2.                                                                      |
| `.github/workflows/deploy-pages.yml` | Verification plus one complete Cloudflare Pages Direct Upload publisher.                                                       |
| `_headers`                           | Static response headers, including native demo cross-origin isolation.                                                         |
| `_redirects`                         | Canonical About and Web demos paths.                                                                                           |
| `robots.txt`                         | Crawler policy template; the build injects the canonical origin into its sitemap URL.                                          |
| `docs/deployment.md`                 | Local development, native builds, manual upload and GitHub/Cloudflare configuration.                                           |
| `docs/artwork.md`                    | Identity, illustration, screenshot and icon-library provenance.                                                                |
| `.cache/`                            | Ignored native output, private sample keys, test fixtures and browser evidence.                                                |
| `dist/`                              | Ignored complete static deployment.                                                                                            |
| `release/`                           | Ignored delivery ZIPs and checksums.                                                                                           |

## Templates and icons

The build reads page fragments and inserts them into the shared layout. Template variables use `{{UPPERCASE_NAME}}`. `replaceTokens` rejects unknown variables. Escape plain metadata before inserting it into HTML. Add new shared tokens in `scripts/build.mjs`; do not create a second renderer or duplicate sample metadata in a template.

UI icons come from `lucide-static`; platform and GitHub brand icons come from `@fortawesome/free-brands-svg-icons`. `scripts/icons.mjs` reads selected SVGs and returns `ICON_*` tokens. All icons have `aria-hidden="true"` and `focusable="false"`; their visible link text or accessible label supplies the meaning. Add icons to this allowlist rather than loading an entire sprite, font, JavaScript package or remote icon service in the browser. Preserve both packages' license notices in the deployed output.

Official Haylen SVGs must remain byte for byte intact. Do not regenerate them, convert them through Python or keep extra copies at repository root. Feature illustrations are editable SVG sources under `src/public/assets/features/`; they illustrate capabilities and must not be described as engine screenshots. Screenshot assets must come from real compiled Haylen output.

## Search and sharing

The production origin is `https://haylenengine.com`, defined once in `src/data/site.json`. Update that configuration for an intentional domain migration; do not derive canonical URLs from preview hosts or browser requests. Use unique page titles/descriptions and absolute canonical, Open Graph and Twitter image URLs. Gallery query parameters canonicalize to `/demos/`. Read image dimensions from the actual PNG. Serialize JSON-LD safely and describe real visible content without invented ratings, reviews or FAQ entries.

Generate `dist/sitemap.xml` with the four canonical public pages, including `/playground/`. Do not invent modification dates or add 404s, query combinations, native entry points or binary assets. The branded 404 has `noindex` and returns HTTP 404. Native sample/player/frame responses have `X-Robots-Tag: noindex, follow`; keep them crawlable so crawlers can read that directive. The gallery and playground editor remain indexable. Submit the sitemap to the domain's verified Search Console property separately; generated files do not prove indexing or ranking.

## Sample catalogue and generated output

A catalogue entry has:

- `path`: a unique `apps/<slug>`, `games/<slug>`, `stress/<slug>`, `cpp/<slug>` or `tests` path.
- `name`: the upstream app name.
- `category`: `Games`, `Apps`, `Stress`, `Tests` or `C++`.
- `description`: a short plain-English explanation of the sample.
- `cover`: a validated lowercase theme key.
- Optional `image`: a local reviewed PNG, JPG or WebP filename in `assets/samples/`.

The native orchestrator discovers upstream `app.json` projects, updates names/categories, preserves curated descriptions/images, adds new supported projects and removes entries for deleted projects. Unknown categories or invalid paths fail explicitly. Tests verify discovery with added, renamed and deleted projects.

Native output is staged at `.cache/web-demos-staging/` and promoted to `.cache/web-demos/` only after a successful batch. Its manifest has `schemaVersion: 1` and a `samples` map keyed by catalogue path. An available entry requires actual engine-generated `index.html` and a fully valid `.wasm` module. The manifest records engine checkout provenance where Git metadata exists. Do not invent a commit for a tarball.

The site builder copies each entire verified folder to `dist/web-demos/<sample>/`, preserving its HTML, WASM, scripts, plugins and content. Demo links point directly to `../web-demos/<sample>/index.html` and must have **`target="_blank" rel="noopener noreferrer"`**. Explain in the accessible label that a new tab opens. Keep Home/About/gallery navigation in the same tab. Cloudflare can canonicalize a real `index.html` URL to its containing directory; tests must check the explicit link and the served canonical URL separately.

Never mark a sample available based only on source code, an image, a manifest flag or a compiler exit code. Verify its output. Never silently omit a failed sample or a deployment file. `HAYLEN_REQUIRE_ALL_DEMOS=1` requires every catalogue sample before a production upload.

## Native packaging and static startup

Use the official Haylen compiler. Release is the default. Its protected-content web shard target is set to 8 MiB in the imported upstream build module, leaving room beneath Pages' 25 MiB file limit. Do not modify the engine source or manually split an opaque ZIP, WASM or protected-content file. Development ZIPs can exceed the hosting limit.

Desktop tools use the upstream host identifiers under `build/artifacts/desktop/<host>-<arch>/`: `macos`, `linux` or `windows`, followed by `arm64` or `x64`. Preserve `x64` when resolving `haylen-content`; `x86_64` belongs to other toolchain contexts and is not the desktop artifact directory name. Windows tools have the `.exe` suffix. Check that the tool was generated before creating sample keys, and preserve process errors in diagnostics.

The builder adjusts Lua `config.json` files to preload every existing protected-content shard before startup. For C++ output, it reads the Emscripten file-package metadata and adds only missing shards to the generated page bootstrap through exported `Module.FS`; preserve the generated JS, WASM and data binary. Guard this upstream contract and fail explicitly if its format changes. Avoid duplicate writes of files already embedded in the C++ data package. Transparent sample pages receive a dark browser background.

Temporary keys for public demo releases belong in `.cache/sample-keys/` and never enter `dist/`, ZIPs or Git. Use `HAYLEN_KEYS_DIR` when persistent engine release identities are intentionally supplied. Do not print keys or authentication tokens.

`filesUnder` rejects symlinks and unsupported entries. Validate complete WASM modules, not only their eight-byte header. Enforce **25 MiB per file** and the actual Pages plan's file-count allowance. The builder defaults to 20000 files; a browser drag-and-drop upload has a separate 1000-file limit. Every file must be included or the build must fail.

## Environment variables

| Variable                              | Owner and meaning                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `HAYLEN_WEB_DEMOS_DIR`                | Site build input; defaults to `.cache/web-demos`.                                         |
| `HAYLEN_DIST_DIR`                     | Isolated test output; only `dist/` or a directory inside `.cache/` is permitted.          |
| `HAYLEN_REQUIRE_ALL_DEMOS=1`          | Require native output for every sample.                                                   |
| `HAYLEN_REQUIRE_PLAYGROUND_RUNTIME=1` | Require the verified editable player in `.cache/web-player/` for production.              |
| `CLOUDFLARE_MAX_FILES`                | File-count limit for the actual Pages plan; defaults to 20000.                            |
| `HAYLEN_PYTHON`                       | Optional executable for the upstream compiler; defaults to `python3`.                     |
| `HAYLEN_KEYS_DIR`                     | Existing upstream content-key directory, when intentionally supplied.                     |
| `CPM_SOURCE_CACHE`                    | Upstream native dependency cache.                                                         |
| `CLOUDFLARE_API_TOKEN`                | GitHub secret used only by Wrangler publication.                                          |
| `CLOUDFLARE_ACCOUNT_ID`               | GitHub secret containing the target account ID.                                           |
| `CLOUDFLARE_PAGES_PROJECT`            | GitHub variable or secret with the Direct Upload project name; variable takes precedence. |

## Commands and test boundaries

Use Node.js 22 for all commands below:

```sh
npm install
npm run format:check
npm run build
npm test
npx playwright install chromium firefox webkit
npm run test:browser
npm run preview
```

Run `npm install`, `npm run build` and `npm test` after page or asset changes. `npm ci` installs the lockfile in CI or an isolated checkout. `npm run format` formats maintained source; official/public SVGs and generated artifacts are excluded. The preview uses Wrangler and the compiled `dist/`, including real Cloudflare header/redirect behavior.

For a complete site with native samples:

```sh
npm run demos:build -- --engine-dir ../haylen --jobs 3
HAYLEN_REQUIRE_ALL_DEMOS=1 npm run build
npm test
HAYLEN_REQUIRE_ALL_DEMOS=1 npm run test:demos
```

The compiler needs its own Python, CMake, Ninja, C++ and Emscripten tools. `--only games/tiny-island` supports focused local native builds; do not use it for a complete production upload. `--config Debug` is for native investigation and still must satisfy output limits.

Website browser tests cover Chromium desktop/tablet/mobile, Firefox desktop and WebKit desktop/mobile, widths from 320 to 1920 px, image loading, navigation, search/category combinations, empty states, no-JavaScript links, keyboard focus, motion controls, reduced motion, table scrolling, SEO and 404s. Test hero children against their actual container bounds; never hide overflow or crop glows/badges to conceal a layout defect. Layout screenshots use reduced motion; the separate motion test verifies changing frames, pause/resume and preference changes. On macOS, the Firefox launch configuration isolates `MOZ_APP_DATA` and `MOZ_LOCAL_APP_DATA` inside `.cache/firefox/` so automated tests do not access protected personal browser data. Browser emulation does not prove physical-device behavior. Tailwind CSS 4 targets modern browsers; consult its documented compatibility floor before claiming support for older versions.

Native browser tests must open the actual gallery link in a new tab, retain the gallery, confirm `window.opener === null`, await real rendering statistics, reject retry/error screens, check network/console failures and send bounded input. A successful compile or visible canvas is not proof of successful startup. Startup tests are not exhaustive gameplay, audio or physical-device tests. Report what actually ran, including skips and infrastructure failures.

Browser screenshots and traces belong in `.cache/browser-results/`, `.cache/demo-results/` or another ignored subdirectory of `.cache/`. Stop only preview/browser processes created for the current check.

## Deployment and delivery

Cloudflare Pages is the deployment target. The GitHub Actions workflow is the single publisher for site plus samples. Do not enable an additional native Pages Git auto-deployment for the same project, because it could replace the complete output with a website-only build. Pull requests run verification without production uploads. Production publication is enabled when `CLOUDFLARE_PAGES_PROJECT` is set; otherwise it is skipped with a setup notice. When enabled, production checks credentials, compiles every sample, builds and tests the complete site, then uploads all of `dist/` once. Missing token/account configuration or a failed native build must fail the enabled publication job.

A manual browser upload ZIP must contain the **contents of `dist/` at its root**, with `index.html`, `_headers`, assets and `web-demos/` alongside each other. Do not put a `dist/` wrapper, source code, dependencies, caches or keys into that upload ZIP. Verify archive integrity and every demo entry point. Keep archives under ignored `release/` and make their names distinguishable from source archives.

## Playground architecture and boundaries

- `src/pages/playground.html` is the editor shell. `src/playground/editor.mjs` owns UI, CodeMirror states, local imports, diagnostics, save/reload scheduling and iframe lifecycle. `editor.css` styles only this page. These dependencies are bundled locally with esbuild, without a CDN, hydration or server.
- `src/playground/project.mjs` owns validated relative paths, atomic project operations, package limits and incremental IndexedDB persistence. `archive.mjs` owns offline ZIP import/export and expansion checks. Never put user file names or file contents into `innerHTML`.
- `src/playground/runtime.mjs` is the disposable native host; `src/public/playground/runtime.html` supplies its canvas. `bridge.mjs` authenticates source, origin and session at startup, then transfers a private MessagePort for commands/events. This avoids lost window messages during WebKit focus transitions. Close ports and discard stale sessions on restart. Only this frame owns `Module.haylen`; the canonical files stay in the editor. File operations reach the overlay through `setFile`/`removeFile`/`applyChanges`. Do not execute project HTML/JavaScript in the parent. Fresh Play and edits that require a restart recreate the host, avoiding stale WebKit audio/context work; ordinary hot reload retains it.
- `src/public/playground/starter/` is the original Skybound Lua platformer with JSON data and SVG art. Asset API paths are relative to `content/`; package paths include that prefix. `source/main.lua` is the required entry point. Generate the starter manifest from real files, never a second maintained list.
- `scripts/playground-runtime.mjs` stages the official generic player from `build/artifacts/web/player/` into ignored `.cache/web-player/`. Preserve its four runtime files and provenance manifest. Validate full WASM, file limits and the editable API. A protected sample build is not an editable player. Do not change Haylen engine code in this site repository.
- `scripts/playground.mjs` bundles page-only assets, emits dependency notices, injects the verified player and generates the service worker/cache revision from actual output bytes. Production requires `HAYLEN_REQUIRE_PLAYGROUND_RUNTIME=1`; a website-only build keeps the editor usable but disables Play with an explanation.
- The service worker is a static browser asset scoped to `/playground/`, not a deployed Cloudflare Worker. Cache only the editor, starter, shared branding/styles and generic player. Use canonical extensionless frame URLs so cached redirected responses cannot break navigation. Do not cache all sample folders or force-activate updates while projects are open. Report offline readiness only after all assets are cached.
- Projects stay on the device. IndexedDB is a convenience, exported ZIPs are backups. Keep limits at 1,000 files/folders, 16 MiB/file, 64 MiB/project and 1 MiB/editable text unless deliberately reviewed. Do not silently omit files, overwrite conflicts or lose empty folders on ZIP export. The current workspace assumes one editing tab; it does not merge concurrent edits.
- An iframe cannot reliably interrupt infinite loops in Haylen's single-thread web runtime. Do not claim hard isolation or use JavaScript timers as proof of cancellation. Ordinary Lua errors must leave controls/editing usable, and fresh Run must recover corrected code. A valid-code revert with an empty, non-resuming reload report gets a fresh Run fallback.
- `playwright.playground.config.mjs` and `tests/playground/` cover editor layouts, files, images, persistence, ZIPs and actual player execution/hot reload/offline restart. Runtime tests skip only when an optional local player is absent; production requires it. Evidence stays in ignored `.cache/playground-results/`.

```sh
npm run playground:runtime -- --engine-dir ../haylen
HAYLEN_REQUIRE_PLAYGROUND_RUNTIME=1 npm run build
npm run test:playground
```

Stage the player after compiling upstream web samples/player. The website-only verification job can test editing without native tools. Publication stages the player after compiling samples, verifies the complete playground, and uploads the same single static `dist/`.

## Git workflow and repository hygiene

The repository is `https://github.com/haylen-org/haylen-site`. Follow the user's direct-to-main workflow: **one commit per requested delivery, no PR, no release, no co-author trailers**. Use the configured human identity. Publish only when authorized by the session; a local commit alone does not authorize a push. Do not rewrite published history or amend a published commit without explicit authorization.

Before staging, inspect status and intended filenames. Stage explicit source/config/documentation paths. Review the staged diff, lockfile, file modes and `git diff --cached --check`. Verify the snapshot excludes `dist/`, `.cache/`, `.wrangler/`, `node_modules/`, `release/`, engine checkouts, logs, local environment files, keys, saved browser authentication and temporary editor files. `.gitignore` does not remove an already tracked file; inspect tracked paths separately.

Preserve source SVGs/screenshots, the lockfile, tests, documentation, workflow and shared editor/formatter settings. Use `git check-ignore -v --no-index -- <path>` for both ignored artifacts and retained source examples. Never hide all images, JSON/YAML or arbitrary archives through a broad extension rule. Do not print private configuration values during review. Verify the pushed commit/branch and report CI state separately from local test results.
