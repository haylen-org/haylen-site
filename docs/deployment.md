# Build and publish

The website is entirely static. Node.js 22 compiles its HTML and Tailwind CSS 4. GitHub Actions invokes the upstream Haylen compiler to produce each sample, then uploads the entire `dist/` directory to a Cloudflare Pages Direct Upload project.

## Local website

```sh
npm install
npm run build
npm test
npm run preview
```

The preview uses Wrangler, including the actual Cloudflare headers and redirects. The website alone builds without Python or the engine checkout. Samples without compiled assets have a source link and a pending web status.

## Complete release with every sample

```sh
npm ci
npm run demos:build -- --engine-dir ../haylen --jobs 3
npm run playground:runtime -- --engine-dir ../haylen
HAYLEN_REQUIRE_ALL_DEMOS=1 HAYLEN_REQUIRE_PLAYGROUND_RUNTIME=1 npm run build
npm test
npx playwright install chromium firefox webkit
npm run test:browser
HAYLEN_REQUIRE_ALL_DEMOS=1 npm run test:demos
HAYLEN_REQUIRE_PLAYGROUND_RUNTIME=1 npm run test:playground
```

The upstream compiler needs Python 3.15, CMake, Ninja and a C++20 toolchain. It installs its pinned Emscripten and other tools. Linux prerequisites are listed in the workflow. The site's runtime and tests use Node.js 22; there are no Python site scripts.

`demos:build` discovers the current `app.json` projects in the engine's `samples/`, reconciles names and categories into the single catalogue at `src/data/samples.json`, and preserves the curated descriptions and images of known projects. New projects in supported categories get their own entry and source link automatically. Unsupported categories fail explicitly. `--only games/tiny-island` is available for focused local builds; production requires every discovered sample.

The default native configuration is **Release**. The Tests sample exceeds Pages' 25 MiB individual-file limit as a development ZIP. The orchestrator calls Haylen's own release/content builder with its web shard target set to **8 MiB**, leaving room for overhead. This configuration is applied to the imported upstream module in memory because its `run` command does not expose the content builder's `--shard-target` argument. The engine source files remain unchanged. Every copied file is checked against the actual 25 MiB limit. No content is removed, externally hosted or replaced by a fake demo.

The native content tool creates disposable keys for these public samples under `.cache/sample-keys/`; no raw key files enter `dist/`, Git or the delivery ZIPs. Supply `HAYLEN_KEYS_DIR` with existing engine keys to retain stable release identities between deployments. Temporary public demo releases do not promise content-update compatibility across builds.

Native output is staged under `.cache/web-demos-staging/`. A complete successful batch is promoted to `.cache/web-demos/`. A failure exits nonzero and never publishes a partial manifest. The site builder validates HTML entry points, complete WASM modules, file sizes, file counts and catalogue membership before rendering links.

The complete deployed tree is:

```text
dist/
  index.html
  about/index.html
  demos/index.html
  playground/
    index.html
    editor.js
    editor.css
    runtime.html
    runtime-host.js
    starter.json
    starter/
    runtime/
    sw.js
  404.html
  favicon.svg
  assets/
  _headers
  _redirects
  robots.txt
  sitemap.xml
  web-demos/
    manifest.json
    games/tiny-island/index.html
    games/taskbar-quest/index.html
    apps/music-streaming/index.html
    apps/online-store/index.html
    apps/photo-social/index.html
    apps/ride-hailing/index.html
    stress/many-sprites/index.html
    stress/many-bodies/index.html
    stress/streamed-map/index.html
    stress/busy-interface/index.html
    tests/index.html
    cpp/embedding/index.html
```

Each demo directory also contains its actual WASM, loader, protected content, plugins and other generated assets. Demo buttons point **directly to that directory's `index.html`** and open a separate tab with `noopener noreferrer`, keeping the gallery open. No iframe, application server or client-side route is required.

## GitHub → Cloudflare Pages

Create a Cloudflare Pages **Direct Upload** project. Keep this workflow as the single publisher for that project; disable any separate automatic Pages Git deployment.

Configure these values in the website's GitHub repository:

| Kind               | Name                       | Value                                                               |
| ------------------ | -------------------------- | ------------------------------------------------------------------- |
| Secret             | `CLOUDFLARE_API_TOKEN`     | Token with Cloudflare Pages edit permission for the account.        |
| Secret             | `CLOUDFLARE_ACCOUNT_ID`    | Cloudflare account ID.                                              |
| Variable or secret | `CLOUDFLARE_PAGES_PROJECT` | Exact name of the Direct Upload project; variable takes precedence. |
| Optional variable  | `CLOUDFLARE_MAX_FILES`     | File-count allowance for the actual Pages plan; defaults to 20000.  |

Push to `main` or run **Publish Haylen site and WASM demos** manually. Pull requests run the website checks without production secrets or uploads. Production performs website checks, validates configuration, checks out Haylen `main`, compiles every sample, injects every folder into `dist/`, opens each demo in a separate Chromium tab and uploads **all of `dist/` in one deployment**. Publication is enabled only after `CLOUDFLARE_PAGES_PROJECT` is set. Until then, website verification still runs and reports a setup notice. When publication is enabled, missing secrets, a failed sample, runtime smoke failure or exceeded hosting limit stops the upload.

The manifest records the checked-out engine commit in CI. `main` intentionally tracks the latest engine; its integration can require maintenance when upstream contracts change. Native compilation is distinct from browser startup checks and from a complete gameplay test. Browser screenshots and traces are retained as workflow artifacts.

The `/web-demos/*` headers retain cross-origin isolation for native sample pages. The current single-thread Haylen web player does not require SharedArrayBuffer or isolation. All native resources are served from the same static origin. Browser capabilities and hardware still govern WebGPU, WebGL2 and audio availability.

## Local browser playground

`/playground/` contains the editor. Its Lua/JSON syntax highlighting, project tree, file/folder operations, drag-and-drop imports, image previews, ZIP imports/exports and IndexedDB saves run locally. Play/Pause/Stop, hot reload, diagnostics and touch controls talk to the actual editable Haylen player in a disposable iframe.

After compiling the web player upstream, run `npm run playground:runtime -- --engine-dir ../haylen`. The command stages the four official runtime artifacts under ignored `.cache/web-player/`, validates the complete WASM/API and records its digest and available Git provenance. It does not rebuild or patch the engine. The site builder injects this player into `dist/playground/runtime/`. Production sets `HAYLEN_REQUIRE_PLAYGROUND_RUNTIME=1` and fails when it is missing or invalid; a website-only build retains editing/export with Play disabled.

The production workflow stages the player after sample compilation, tests the playground and publishes it in the same `dist/` upload. No extra Cloudflare service, API key, database or application server is needed.

The browser service worker caches only the playground and its runtime/shared assets. Wait for **Ready offline** before disconnecting. First visits still require a download. Updates activate when old playground tabs close; they do not force-reload unsaved work. Files are local to this domain and browser profile. Export ZIPs as backups; clearing browser storage can remove the workspace and offline cache. Use one editing tab per workspace.

The preview can recover ordinary Lua errors. It cannot reliably interrupt an infinite Lua/native loop on the engine's current single thread. C++ and native plugin compilation still use Haylen's normal toolchain.

Run `npm run test:playground` for the editor/browser matrix and real player integration. Runtime cases skip when an optional local player is absent, but must run for production. CI verifies the editor in all configured browsers, then runs the complete player checks in Chromium after native compilation, matching the native-demo smoke-test environment. Local desktop checks also exercise the player in Firefox and WebKit. Results and screenshots stay in `.cache/playground-results/`.

## Search and social previews

The confirmed production origin is **https://haylenengine.com**, configured in `src/data/site.json`. The build generates absolute canonical and social URLs, unique page metadata, safely serialized Schema.org JSON-LD, `sitemap.xml` and the sitemap declaration in `robots.txt`. The social cover is a local PNG with measured dimensions. Gallery search/filter URLs share the canonical `/demos/` URL. The sitemap lists Home, About, Demos and Playground; the 404, native sample responses and playground player/frame are excluded from indexing.

Attach the domain to this Pages project and use HTTPS. After deployment, verify the domain in [Google Search Console](https://search.google.com/search-console) and submit `https://haylenengine.com/sitemap.xml`. Neither the build nor this repository submits it automatically. Inspect the four public page URLs with URL Inspection. Sitemaps and structured data help discovery and interpretation, but do not guarantee indexing, rich results or rankings. For domain changes, update the single site configuration and configure a permanent redirect at Cloudflare from the old domain.

References: [Google canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [Google sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Open Graph](https://ogp.me/), [Schema.org SoftwareSourceCode](https://schema.org/SoftwareSourceCode).

The browser suite runs Chromium, Firefox and WebKit. On macOS the Firefox configuration uses isolated app-data directories under `.cache/firefox/`, avoiding access to the user's personal Firefox data ([Mozilla issue](https://bugzilla.mozilla.org/show_bug.cgi?id=2060476)). The hero uses standard CSS/SVG animation, with a still no-JavaScript fallback, pause control and reduced-motion support. Tailwind CSS 4 requires modern browser versions ([compatibility](https://tailwindcss.com/docs/compatibility)); do not claim support for every historical browser version.

References: [Cloudflare limits](https://developers.cloudflare.com/pages/platform/limits/), [Direct Upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/), [Haylen distribution](https://github.com/haylen-org/haylen/blob/main/docs/tools/distribution.md), [Haylen protected content](https://github.com/haylen-org/haylen/blob/main/docs/content/content.md).

## Static sample startup

For Lua release pages, the site builder extends the generated `config.json` download list to include every existing protected-content shard. Haylen's own loader downloads those files, shows its normal progress and supplies their exact bytes to the runtime before it starts. This avoids the missing-chunk startup failure observed when a sample reads content synchronously before the background content store has acquired it. It changes no engine source, loader code or WASM. All original release files remain in their sample folder. These bounded public samples intentionally trade a larger initial download for reliable complete startup; this gallery does not claim to demonstrate streaming huge worlds. For the C++ sample, the builder adds a preload stage to the generated page bootstrap: it downloads the existing release files and writes them through Emscripten's exported `Module.FS` before the original runtime starts. The C++ WASM and generated data file stay unchanged. This also removes a dependency on byte-range response behavior during sample startup. Transparent sample pages receive a dark browser background suited to the website.
