# Haylen website

## Purpose and public content

This repository is the static website for [Haylen](https://github.com/haylen-org/haylen), an open-source C++20 and Lua engine for games and apps. It contains Home, About and Web demos, plus a branded 404 page. Cloudflare Pages hosts both the website and the complete compiled WebAssembly sample folders.

Write new public copy in clear, common English. Explain what a feature does before naming its implementation. Say that Haylen is an engine for 2D games and apps. Describe graphics, physics, UI, audio, input, native plugins and supported platforms with specific examples. Do not add vague slogans, invented benchmarks, unsupported platform claims or claims of production certification. Haylen supports 2D today; future 3D support is not a current feature.

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

## File map and ownership

| Path                                 | Responsibility                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/layout.html`                    | Shared document shell, metadata, header, navigation and footer.                                                                |
| `src/pages/home.html`                | Engine overview, feature illustrations, plugins, platforms and setup links.                                                    |
| `src/pages/about.html`               | Architecture, native plugins, platform/API table, workflow and license.                                                        |
| `src/pages/demos.html`               | Search/filter UI and the build-rendered sample catalogue.                                                                      |
| `src/data/samples.json`              | The single authoritative catalogue for sample metadata.                                                                        |
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
| `robots.txt`                         | Public crawler policy.                                                                                                         |
| `docs/deployment.md`                 | Local development, native builds, manual upload and GitHub/Cloudflare configuration.                                           |
| `docs/artwork.md`                    | Identity, illustration, screenshot and icon-library provenance.                                                                |
| `.cache/`                            | Ignored native output, private sample keys, test fixtures and browser evidence.                                                |
| `dist/`                              | Ignored complete static deployment.                                                                                            |
| `release/`                           | Ignored delivery ZIPs and checksums.                                                                                           |

## Templates and icons

The build reads page fragments and inserts them into the shared layout. Template variables use `{{UPPERCASE_NAME}}`. `replaceTokens` rejects unknown variables. Escape plain metadata before inserting it into HTML. Add new shared tokens in `scripts/build.mjs`; do not create a second renderer or duplicate sample metadata in a template.

UI icons come from `lucide-static`; platform and GitHub brand icons come from `@fortawesome/free-brands-svg-icons`. `scripts/icons.mjs` reads selected SVGs and returns `ICON_*` tokens. All icons have `aria-hidden="true"` and `focusable="false"`; their visible link text or accessible label supplies the meaning. Add icons to this allowlist rather than loading an entire sprite, font, JavaScript package or remote icon service in the browser. Preserve both packages' license notices in the deployed output.

Official Haylen SVGs must remain byte for byte intact. Do not regenerate them, convert them through Python or keep extra copies at repository root. Feature illustrations are editable SVG sources under `src/public/assets/features/`; they illustrate capabilities and must not be described as engine screenshots. Screenshot assets must come from real compiled Haylen output.

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

The builder adjusts Lua `config.json` files to preload every existing protected-content shard before startup. For C++ output, it reads the Emscripten file-package metadata and adds only missing shards to the generated page bootstrap through exported `Module.FS`; preserve the generated JS, WASM and data binary. Guard this upstream contract and fail explicitly if its format changes. Avoid duplicate writes of files already embedded in the C++ data package. Transparent sample pages receive a dark browser background.

Temporary keys for public demo releases belong in `.cache/sample-keys/` and never enter `dist/`, ZIPs or Git. Use `HAYLEN_KEYS_DIR` when persistent engine release identities are intentionally supplied. Do not print keys or authentication tokens.

`filesUnder` rejects symlinks and unsupported entries. Validate complete WASM modules, not only their eight-byte header. Enforce **25 MiB per file** and the actual Pages plan's file-count allowance. The builder defaults to 20000 files; a browser drag-and-drop upload has a separate 1000-file limit. Every file must be included or the build must fail.

## Environment variables

| Variable                     | Owner and meaning                                                                |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `HAYLEN_WEB_DEMOS_DIR`       | Site build input; defaults to `.cache/web-demos`.                                |
| `HAYLEN_DIST_DIR`            | Isolated test output; only `dist/` or a directory inside `.cache/` is permitted. |
| `HAYLEN_REQUIRE_ALL_DEMOS=1` | Require native output for every sample.                                          |
| `CLOUDFLARE_MAX_FILES`       | File-count limit for the actual Pages plan; defaults to 20000.                   |
| `HAYLEN_PYTHON`              | Optional executable for the upstream compiler; defaults to `python3`.            |
| `HAYLEN_KEYS_DIR`            | Existing upstream content-key directory, when intentionally supplied.            |
| `CPM_SOURCE_CACHE`           | Upstream native dependency cache.                                                |
| `CLOUDFLARE_API_TOKEN`       | GitHub secret used only by Wrangler publication.                                 |
| `CLOUDFLARE_ACCOUNT_ID`      | GitHub secret containing the target account ID.                                  |
| `CLOUDFLARE_PAGES_PROJECT`   | GitHub variable with the Direct Upload project name.                             |

## Commands and test boundaries

Use Node.js 22 for all commands below:

```sh
npm install
npm run format:check
npm run build
npm test
npx playwright install chromium webkit
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

Website browser tests cover Chromium desktop/tablet/mobile and WebKit mobile, widths from 320 to 1920 px, image loading, navigation, search/category combinations, empty states, no-JavaScript links, keyboard focus, reduced motion, table scrolling and 404s. Test hero children against their actual container bounds; never hide overflow or crop glows/badges to conceal a layout defect.

Native browser tests must open the actual gallery link in a new tab, retain the gallery, confirm `window.opener === null`, await real rendering statistics, reject retry/error screens, check network/console failures and send bounded input. A successful compile or visible canvas is not proof of successful startup. Startup tests are not exhaustive gameplay, audio or physical-device tests. Report what actually ran, including skips and infrastructure failures.

Browser screenshots and traces belong in `.cache/browser-results/`, `.cache/demo-results/` or another ignored subdirectory of `.cache/`. Stop only preview/browser processes created for the current check.

## Deployment and delivery

Cloudflare Pages is the deployment target. The GitHub Actions workflow is the single publisher for site plus samples. Do not enable an additional native Pages Git auto-deployment for the same project, because it could replace the complete output with a website-only build. Pull requests run verification without production uploads. Production publication is enabled when `CLOUDFLARE_PAGES_PROJECT` is set; otherwise it is skipped with a setup notice. When enabled, production checks credentials, compiles every sample, builds and tests the complete site, then uploads all of `dist/` once. Missing token/account configuration or a failed native build must fail the enabled publication job.

A manual browser upload ZIP must contain the **contents of `dist/` at its root**, with `index.html`, `_headers`, assets and `web-demos/` alongside each other. Do not put a `dist/` wrapper, source code, dependencies, caches or keys into that upload ZIP. Verify archive integrity and every demo entry point. Keep archives under ignored `release/` and make their names distinguishable from source archives.

## Git workflow and repository hygiene

The repository is `https://github.com/haylen-org/haylen-site`. Follow the user's direct-to-main workflow: **one commit per requested delivery, no PR, no release, no co-author trailers**. Use the configured human identity. Publish only when authorized by the session; a local commit alone does not authorize a push. Do not rewrite published history or amend a published commit without explicit authorization.

Before staging, inspect status and intended filenames. Stage explicit source/config/documentation paths. Review the staged diff, lockfile, file modes and `git diff --cached --check`. Verify the snapshot excludes `dist/`, `.cache/`, `.wrangler/`, `node_modules/`, `release/`, engine checkouts, logs, local environment files, keys, saved browser authentication and temporary editor files. `.gitignore` does not remove an already tracked file; inspect tracked paths separately.

Preserve source SVGs/screenshots, the lockfile, tests, documentation, workflow and shared editor/formatter settings. Use `git check-ignore -v --no-index -- <path>` for both ignored artifacts and retained source examples. Never hide all images, JSON/YAML or arbitrary archives through a broad extension rule. Do not print private configuration values during review. Verify the pushed commit/branch and report CI state separately from local test results.
