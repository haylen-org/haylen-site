# Haylen website

## Purpose and public content

This repository is the static website for [Haylen](https://github.com/haylen-org/haylen), an open-source C++ and Lua engine for games and apps. It contains Home, About, Demos and a local browser Playground, plus a branded 404 page. Cloudflare Pages hosts the website, editable player and complete compiled WebAssembly sample folders.

Write new public copy in clear, common English. Refer to the language as C++ without a version number in public copy, metadata and artwork. Keep actual toolchain requirements in technical deployment documentation. Explain what a feature does before naming its implementation. Position Haylen as an engine for games and apps without repeatedly qualifying games as 2D in public headings, descriptions or sharing metadata. Describe graphics, physics, UI, audio, input, native plugins and supported platforms with specific examples. Do not add vague slogans, invented benchmarks, unsupported platform claims or claims of production certification. Future 3D support is not a current feature. Preserve accurate API names such as `haylen.graphics2d` in working code.

Home presents engine features using original feature illustrations. Do not put sample screenshots, app artwork, sample cards or direct runnable sample links on Home. Keep those on Web demos. About explains the architecture, project structure, plugin system, platform graphics APIs and development workflow.

Keep public explanations focused on Haylen, without naming Varn. Use common prose for project settings, code and assets instead of mixing filesystem paths into sentences. Preserve exact paths in code examples, dedicated file labels, the editor tree and actionable validation errors where they are needed.

The README is a short project presentation, with the official mark and useful project links. Keep setup, deployment, troubleshooting and agent rules in their own files. Do not append task logs, old delivery reports or conversational history to project documentation.

## Runtime and architecture

- The website is entirely static HTML, CSS, SVG and browser JavaScript. It has no application server, API, database, framework hydration or deployed Cloudflare Worker.
- Node.js **22.x** is the only website build runtime. `.nvmrc` and `package.json` define it. Use npm and preserve `package-lock.json`.
- Tailwind CSS **4** is built through its local CLI. Do not use a development CDN or introduce Tailwind 3 configuration.
- Python belongs only to the upstream Haylen native compiler. This website has no Python scripts, Pillow, Python site generator or Python test runner.
- Build output, dependencies, native artifacts, temporary sample keys and browser evidence stay outside Git.
- Availability is rendered into HTML at build time. Do not fetch a manifest after load to swap demo state or links.
- Keep initial content visible. Avoid reveal animations, theme flashes, remote font loading or effects that hide the page while JavaScript starts.
- The hero uses gentle continuous CSS/SVG motion without canvas, WebGL or an animation dependency. Keep the official logo intact and static. Ambient lights and orbits start only when JavaScript enables them. Keep the same CSS animation instances while paused outside the viewport or in hidden tabs, and resume their progress when visible. Handle `pageshow` and `pagehide` so returning through browser history resumes correctly. Respect `prefers-reduced-motion` and keep a static scene without JavaScript. Preserve the user-requested absence of animation play/pause controls. Never animate layout dimensions or hide content during startup.
- Keep the visual scene and C++/Lua blocks in separate grid rows. Orbital trails must end at their particles and fade behind the direction of travel. Keep all transformed artwork inside its scene at every breakpoint; do not cover buttons or fix overlaps by clipping. Center each wrapped row in the platform strip, including its heading and link on narrow screens. Platform grid icons and labels are centered within their cells.

## File map and ownership

| Path                                 | Responsibility                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/layout.html`                    | Shared document shell, metadata, header, navigation and footer.                                                                |
| `src/partials/`                      | Shared marketing header and footer, omitted from the standalone playground.                                                    |
| `src/pages/home.html`                | Engine overview, feature illustrations, plugins, platforms and setup links.                                                    |
| `src/pages/about.html`               | Architecture, native plugins, platform/API table, workflow and license.                                                        |
| `src/pages/demos.html`               | Search/filter UI and the build-rendered sample catalogue.                                                                      |
| `src/pages/playground.html`          | Static editor shell, local project controls, game preview and help dialogs.                                                    |
| `src/playground/`                    | Browser editor, project/ZIP storage, private player bridge, runtime host and scoped styles.                                    |
| `src/public/playground/`             | Native canvas shell, Action Game game and Photo Social app projects.                                                           |
| `scripts/playground.mjs`             | Page-only bundles, complete browser license notices, player injection and offline cache generation.                            |
| `scripts/playground-runtime.mjs`     | Official generic player staging, editable API/WASM checks and provenance.                                                      |
| `src/data/samples.json`              | The single authoritative catalogue for sample metadata.                                                                        |
| `src/data/site.json`                 | Public site identity, confirmed canonical origin and social image metadata.                                                    |
| `src/tailwind.css`                   | Tailwind imports, explicit source detection and design tokens.                                                                 |
| `src/design.css`                     | Component styles, fixed dark theme, responsive layout, focus and reduced motion.                                               |
| `src/home.css`                       | Home-only editorial layout, capability grid, code example, plugin section and responsive artwork sizing.                       |
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
| `tests/browser/site.spec.mjs`        | Minimal page-opening smoke checks for the four public pages.                                                                   |
| `playwright.config.mjs`              | Website browser matrix and Wrangler preview lifecycle.                                                                         |
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

Home follows an editorial, technical direction. Keep typography and section hierarchy distinct, with four core-system diagrams followed by Lua/C++ development, native plugins and platform support. The neutral light plugin section is a fixed section treatment, not a theme switch. Technical diagrams use original editable SVGs. Their `-small.svg` compositions are selected with static `<picture>` sources so labels and connections remain legible on phones. Reserve the correct aspect ratio for each composition. Code examples use actual Haylen APIs and keep keyboard-scrollable code accessible. Home-only rules belong in `src/home.css`, imported after shared design styles. Remove superseded Home rules instead of stacking new overrides in `src/design.css`.

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

The native orchestrator discovers upstream `app.json` projects, updates names/categories, preserves curated descriptions/images, adds new supported projects and removes entries for deleted projects. Unknown categories or invalid paths fail explicitly.

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
npx playwright install chromium firefox webkit
npm test
npm run preview
```

Run `npm install`, `npm run build` and `npm test` after page or asset changes. `npm ci` installs the lockfile in CI or an isolated checkout. `npm run format` formats maintained source; official/public SVGs and generated artifacts are excluded. The preview uses Wrangler and the compiled `dist/`, including real Cloudflare header/redirect behavior.

For a complete site with native samples:

```sh
npm run demos:build -- --engine-dir ../haylen --jobs 3
HAYLEN_REQUIRE_ALL_DEMOS=1 npm run build
npm test
```

The compiler needs its own Python, CMake, Ninja, C++ and Emscripten tools. `--only games/tiny-island` supports focused local native builds; do not use it for a complete production upload. `--config Debug` is for native investigation and still must satisfy output limits.

Browser smoke checks only open Home, About, Demos and Playground, confirm HTTP 200 and a visible heading, reject JavaScript page errors and wait for the editor workspace to open. Reuse the browser matrix without adding interaction suites.

Keep automated browser checks to opening the public pages. Do not add tests for games, app flows, physics, combat, aiming, simulated controllers, animation geometry or frame matching. Build-time artifact validation and deployment limits remain mandatory.

Browser screenshots and traces belong in `.cache/browser-results/`, `.cache/playground-results/` or another ignored subdirectory of `.cache/`. Stop only preview/browser processes created for the current check.

## Deployment and delivery

Cloudflare Pages is the deployment target. The GitHub Actions workflow is the single publisher for site plus samples. Do not enable an additional native Pages Git auto-deployment for the same project, because it could replace the complete output with a website-only build. Pull requests run verification without production uploads. Production publication is enabled when `CLOUDFLARE_PAGES_PROJECT` is set; otherwise it is skipped with a setup notice. When enabled, production checks credentials, compiles every sample, builds and tests the complete site, then uploads all of `dist/` once. Missing token/account configuration or a failed native build must fail the enabled publication job.

A manual browser upload ZIP must contain the **contents of `dist/` at its root**, with `index.html`, `_headers`, assets and `web-demos/` alongside each other. Do not put a `dist/` wrapper, source code, dependencies, caches or keys into that upload ZIP. Verify archive integrity and every demo entry point. Keep archives under ignored `release/` and make their names distinguishable from source archives.

## Playground architecture and boundaries

- `src/data/playground-examples.json` owns the example catalogue and default project. `scripts/playground.mjs` discovers each project's real files into the generated `playground/examples.json`. Each example needs its own complete app settings, entry script and assets. Keep example versions at `1.0.0` and use descriptive names such as Action Game and Photo Social. `src/playground/examples.mjs` fetches a complete project; switching examples confirms replacement and never merges files or overwrites a saved workspace on startup. New workspaces use Photo Social; saved projects are restored unchanged.
- `src/playground/preview-viewport.mjs` owns Fit, smartphone (390 × 844), tablet (768 × 1024) and desktop (1280 × 800) preview sizes. Resize the existing frame and scale its wrapper to fit the available space without restarting the project. Rotate swaps the current viewport width and height, including Fit, without replacing the app frame. Choosing a preset resets its orientation. These are viewport presets, not hardware emulation. The preview fills the panel space released when the console is hidden. Keep valid positive dimensions when a running preview is hidden.
- `src/public/playground/examples/photo-social/` adapts the upstream native Photo Social sample. `shell.lua` mounts one app-owned navigation GUI, containing the desktop rail and mobile bottom bar. Navigation changes only scene-owned central content. `page.lua` reserves matching rail/bottom insets without creating navigation controls. Authentication, stories and `composerScreen` steps hide the shared GUI without unmounting it. `Shell.current` owns tab selection; the shell alone updates menu icons and unread badges. `rootTab` distinguishes a root profile from a pushed profile. Route keys reuse an existing post, person or conversation in the stack instead of stacking navigation cycles. Home, explore, profile, post, stories, inbox, chat and composer steps own their retained UI and recycled collections. `data/social.lua` owns social records and emits change events; `chats.lua` owns conversations; `photos.lua`, `avatars.lua` and `compose.lua` own visual assets, display crops and asynchronous filters. `services/fake-api.lua` owns delayed authentication handlers. Keep all records in memory, versions at `1.0.0`, and the commented source readable. Use cartoon artwork and retain upstream/font licenses. Do not add real credentials, remote APIs, test tours or game-specific IDE behavior.
- New Post is one bounded flow. Its three scenes declare `composerScreen` and never mount the main navigation. `shell.lua` records the origin stack depth, rejects a second composer or unrelated navigation while it is active, and reserves deferred navigation until completion. Back returns one step; Close pops the entire composer to its origin; publishing clears the flow and replaces the root with Home. Keep caption/place drafts in `compose.lua` across steps. Ending a flow invalidates pending photo/filter work so it cannot modify a later flow.
- Profile section selection belongs to the screen and binds into the recycled header item. Reloading the header must preserve Posts/Saved selection. Saved needs an explicit empty row because the header keeps the collection nonempty. Feed and profile grids hide their scrollbar while retaining gesture, wheel and keyboard scrolling. Person rows use separate clickable avatar/name links and Follow controls. Detail layouts measure the width left after the navigation rail, rather than the whole window. Composer previews align to the top; the photo-library column stretches within its bounded body and hides its scrollbar to keep its grid geometry stable.
- `src/playground/runtime.mjs` ends native text editing before SDL queues a pointer press outside the field, preserving the first click on another control. This uses the existing web player text-input export with `TextInput::Action::Dismissed` (3); check that upstream contract when upgrading the player. Keep native HTML editing inside the field intact.
- Hidden preview panels retain a positive canvas size outside the viewport. Do not hide a running native UI iframe with `display: none`, which gives its renderer an invalid viewport. Expanded preview stays visible across editor breakpoints.

- `src/pages/playground.html` is a generic IDE shell. Do not hardcode a game name, artwork, mechanics, input actions or game-specific help into it. The starter is ordinary editable project data. The activity rail can toggle explorer, code, preview and console. Keep its controls contiguous with 48 px targets. Closing a file preserves its canonical contents and the closed state. `workspace-layout.mjs` owns panel state, while `notifications.mjs` owns dismissible, transient notices. Native dialogs must retain explicit centered margins and accessible headings. File-path validation stays inside the dialog so the user can correct it. `src/playground/editor.mjs` owns UI, CodeMirror states, local imports, diagnostics, save/reload scheduling and iframe lifecycle. `search-panel.mjs` supplies labeled find/replace controls through CodeMirror's public search API, which remains responsible for matching and document transactions. Its layout adapts to the code pane through a container query, including when other panels reduce the available width on desktop. `editor.css` styles only this page. These dependencies are bundled locally with esbuild, without a CDN, hydration or server.
- `src/playground/project.mjs` owns validated relative paths, atomic project operations, package limits and incremental IndexedDB persistence. File buffers are immutable after import. Candidate imports and moves preserve unchanged buffer references so hot reload and incremental saves do not mistake the whole project for edits. `archive.mjs` owns offline ZIP import/export and expansion checks. Never put user file names or file contents into `innerHTML`.
- `src/playground/runtime.mjs` is the disposable native host; `src/public/playground/runtime.html` supplies its canvas. `bridge.mjs` authenticates source, origin and session at startup, then transfers a private MessagePort for commands/events. This avoids lost window messages during WebKit focus transitions. Close ports and discard stale sessions on restart. Only this frame owns `Module.haylen`; the canonical files stay in the editor. File operations reach the overlay through `setFile`/`removeFile`/`applyChanges`. Do not execute project HTML/JavaScript in the parent. Fresh Play and edits that require a restart recreate the host, avoiding stale WebKit audio/context work; ordinary hot reload retains it.
- `src/public/playground/starter/` is the original Action Game action demo. Keep native simulation (`world.lua`, `player.lua`), combat (`combat.lua`, `enemy.lua`), presentation (`renderer.lua`, `hud.lua`, `sprites.lua`, `art.lua`, `effects.lua`) and synthesized audio (`sound.lua`) under separate owners. Physics steps in `fixedUpdate`; frame animation and presentation advance in `update`. Destroy the owned Box2D world on reset/unload. Projectiles use swept ray casts, including the segment from the player to the muzzle, and crate hits apply real impulses. JSON owns level/input data. Use the unchanged original Haylen Tiny Island hero/enemy/effect atlases with their MIT notice. The forest and terrain sheet are generated with imagegen in the same medieval cartoon style, without pixel art. `heroes.lua` owns class tuning. Keep credits and learning documents out of the starter. Retain the required copyright notices in `LICENSE.txt` and record artwork provenance in `docs/artwork.md`. Terrain uses continuous ground/bridge textures through native nine-slices, with the visible top matching the collision box. Input, aiming and touch controls belong to the project in Lua, never the IDE. Enemies face their travel direction while patrolling and stop to aim their attacks. Keep every Lua file readable: one operation per line, explicit domain names, blank lines between responsibilities and English comments explaining the purpose of important blocks. Keep final PNGs unchanged and choose frames through native source rectangles/animators. Asset API paths are relative to `content/`; package paths include that prefix. `source/main.lua` is the required entry point. Generate the starter manifest from real files, never a second maintained list.
- Ranged hero definitions own weapon attachments in the original untrimmed atlas coordinates and a native animation release frame. `sprites.lua` translates those points and pivots into trimmed-frame coordinates, preserves frame durations/events and applies facing before querying or drawing the sprite. `player.lua` releases projectiles after frame animation in `update`, after the engine's fixed steps, so the first rendered shot remains on the visible weapon before its next physics step. Keep the arrow pivot at the bow crossing and the magic pivot at the painted bright core. Do not replace these attachments with fixed world offsets or an unrelated delay.
- `src/layout.html` keeps the shared document head. `src/partials/site-header.html` and `site-footer.html` supply marketing-page chrome through the same strict token renderer. Playground emits neither partial. Its dedicated editor fills the viewport, with panel scrolling and a Back to Home action that always confirms and saves before leaving. Expanded preview keeps the existing iframe in place and makes other panels inert; Escape restores the editor. Do not reparent a live iframe, which can reset its browsing context.
- `scripts/playground-runtime.mjs` stages the official generic player from `build/artifacts/web/player/` into ignored `.cache/web-player/`. Preserve its four runtime files and provenance manifest. Validate full WASM, file limits and the editable API. A protected sample build is not an editable player. Do not change Haylen engine code in this site repository.
- `scripts/playground.mjs` bundles page-only assets, emits dependency notices, injects the verified player and generates the service worker/cache revision from actual output bytes. Production requires `HAYLEN_REQUIRE_PLAYGROUND_RUNTIME=1`; a website-only build keeps the editor usable but disables Play with an explanation.
- The service worker is a static browser asset scoped to `/playground/`, not a deployed Cloudflare Worker. Cache only the editor, example catalogue, all example projects, shared branding/styles and generic player. Use canonical extensionless frame URLs so cached redirected responses cannot break navigation. Do not cache all sample folders or force-activate updates while projects are open. Report offline readiness only after all assets are cached.
- Projects stay on the device. IndexedDB is a convenience, exported ZIPs are backups. Keep limits at 1,000 files/folders, 16 MiB/file, 64 MiB/project and 1 MiB/editable text unless deliberately reviewed. Do not silently omit files, overwrite conflicts or lose empty folders on ZIP export. The current workspace assumes one editing tab; it does not merge concurrent edits.
- An iframe cannot reliably interrupt infinite loops in Haylen's single-thread web runtime. Do not claim hard isolation or use JavaScript timers as proof of cancellation. Ordinary Lua errors must leave controls/editing usable, and fresh Run must recover corrected code. A valid-code revert with an empty, non-resuming reload report gets a fresh Run fallback.
- Importing a complete ZIP replaces every prior file and folder after validation and confirmation. Never merge a project ZIP with the starter. Verify the exported workspace contains only the imported package.
- The starter action map binds left-stick/D-pad movement, right-stick vector aiming, jumping, attacks, dash, hero selection, retry and sound. Native Haylen input applies the controller dead zone. Keep these bindings in the project and adapt its own HUD to the last device used. A previously used mouse position must not override gamepad aiming.
- `tests/browser/site.spec.mjs` is the only browser smoke suite. It does not run example projects. Do not add separate app or game test configurations.

```sh
npm run playground:runtime -- --engine-dir ../haylen
HAYLEN_REQUIRE_PLAYGROUND_RUNTIME=1 npm run build
```

Stage the player after compiling upstream web samples/player. The website-only verification job can test editing without native tools. Publication stages the player after compiling samples, verifies the complete playground, and uploads the same single static `dist/`.

## Git workflow and repository hygiene

The repository is `https://github.com/haylen-org/haylen-site`. Follow the user's direct-to-main workflow: **one commit per requested delivery, no PR, no release, no co-author trailers**. Use the configured human identity. Publish only when authorized by the session; a local commit alone does not authorize a push. Do not rewrite published history or amend a published commit without explicit authorization.

Before staging, inspect status and intended filenames. Stage explicit source/config/documentation paths. Review the staged diff, lockfile, file modes and `git diff --cached --check`. Verify the snapshot excludes `dist/`, `.cache/`, `.wrangler/`, `node_modules/`, `release/`, engine checkouts, logs, local environment files, keys, saved browser authentication and temporary editor files. `.gitignore` does not remove an already tracked file; inspect tracked paths separately.

Preserve source SVGs/screenshots, the lockfile, tests, documentation, workflow and shared editor/formatter settings. Use `git check-ignore -v --no-index -- <path>` for both ignored artifacts and retained source examples. Never hide all images, JSON/YAML or arbitrary archives through a broad extension rule. Do not print private configuration values during review. Verify the pushed commit/branch and report CI state separately from local test results.

## Web guidance and visual system

The project uses a fixed dark theme with neutral surfaces and Haylen blue/violet actions, alongside the unchanged multicolor mark. Keep green out of the IDE action and selection palette. Marketing feature groups use large illustrated rows and clear borders rather than repeated rounded cards. Keep public copy concrete and readable.

Keep the existing modern-browser support floor and use native dialogs, CSS grid, intrinsic sizing, visible focus and appropriate fallbacks. Test responsive layout immediately after viewport changes so correctness does not depend on delayed JavaScript media-query events. Keep agent instructions in this file; do not add local skill installations or skill lockfiles to the repository.
