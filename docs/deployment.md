# Build and publish

The website is entirely static. Node.js 22 compiles its HTML and Tailwind CSS 4. GitHub Actions invokes the upstream Haylen command line to produce each sample, then uploads the entire `dist/` directory to a Cloudflare Pages Direct Upload project.

## Local website

```sh
npm install
npm run build
npx playwright install chromium firefox webkit
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
npx playwright install chromium firefox webkit
npm test
```

The upstream `haylen` command runs through [uv](https://docs.astral.sh/uv), which installs the Python and packages that the engine locks. It also needs CMake, Ninja and a C++20 compiler, and it downloads its pinned Emscripten and shader compiler into the engine's `.tools/`. Linux prerequisites are listed in the workflow. The site's runtime and tests use Node.js 22; there are no Python site scripts.

`demos:build` discovers the current `haylen.json` projects in the engine's `samples/`, reconciles names and categories into the single catalogue at `src/data/samples.json`, and preserves the curated descriptions and images of known projects. New projects in supported categories get their own entry and source link automatically. Unsupported categories fail explicitly. `--only games/tiny-island` is available for focused local builds; production requires every discovered sample.

Apps never compile the engine, so the orchestrator first installs the engine SDKs with `haylen sdk build`: the web SDK, with the player and the Emscripten package that release runtimes link, and the desktop SDK of this machine, whose content tool builds protected releases. Then it runs `haylen app build <sample> --target web --config Release --json` for each sample and copies the site folder that the JSON result names, after Haylen's own verification passed.

The default native configuration is **Release**. The Tests sample exceeds Pages' 25 MiB individual-file limit as a development ZIP. Haylen's web content profile sets no shard target, so the orchestrator starts the same command with that profile's target set to **8 MiB** in memory; a shard holds at most twice its target plus one record, which stays under the limit. The engine source files remain unchanged. Every copied file is checked against the actual 25 MiB limit. No content is removed, externally hosted or replaced by a fake demo.

The content tool of the desktop SDK creates disposable keys for these public samples under `.cache/sample-keys/`, which the orchestrator passes as `HAYLEN_KEYS_DIR`, so the Haylen tooling never writes keys into the user's configuration folder; no raw key files enter `dist/`, Git or the delivery ZIPs. Supply `HAYLEN_KEYS_DIR` with existing engine keys to retain stable release identities between deployments. Temporary public demo releases do not promise content-update compatibility across builds.

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
    examples.json
    examples/
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
    apps/car-dashboard/index.html
    apps/smart-home/index.html
    stress/many-sprites/index.html
    stress/many-bodies/index.html
    stress/streamed-map/index.html
    stress/busy-interface/index.html
    tests/index.html
    cpp/embedding/index.html
```

Each demo directory also contains its actual WASM, loader, protected content, plugins and other generated assets. Haylen's runtime would stream content shards by byte range, but Cloudflare Pages answers ranges of uncached `.hpak` files with the whole file, which the runtime refuses. The site builder therefore lists every shard in the loader's `config.json`, so each sample downloads its whole release before it starts and never asks for a range. Demo buttons point **directly to that directory's `index.html`** and open a separate tab with `noopener noreferrer`, keeping the gallery open. No iframe, application server or client-side route is required.

## GitHub → Cloudflare Pages

Create a Cloudflare Pages **Direct Upload** project. Keep this workflow as the single publisher for that project; disable any separate automatic Pages Git deployment.

Configure these values in the website's GitHub repository:

| Kind               | Name                       | Value                                                               |
| ------------------ | -------------------------- | ------------------------------------------------------------------- |
| Secret             | `CLOUDFLARE_API_TOKEN`     | Token with Cloudflare Pages edit permission for the account.        |
| Secret             | `CLOUDFLARE_ACCOUNT_ID`    | Cloudflare account ID.                                              |
| Variable or secret | `CLOUDFLARE_PAGES_PROJECT` | Exact name of the Direct Upload project; variable takes precedence. |
| Optional variable  | `CLOUDFLARE_MAX_FILES`     | File-count allowance for the actual Pages plan; defaults to 20000.  |

Push to `main` or run **Publish** manually. Pull requests run the page-opening smoke checks without production uploads. Production validates configuration, checks out Haylen `main`, compiles every sample, stages the editable player, validates the complete static output and uploads **all of `dist/` once**. It does not run games or native browser tests. Publication requires `CLOUDFLARE_PAGES_PROJECT`; missing credentials, a failed build, missing artifacts or exceeded hosting limits stop the upload.

The manifest records the checked-out engine commit in CI. `main` intentionally tracks the latest engine; upstream API changes can require maintenance. Compilation and static validation do not prove native startup or gameplay. Screenshots from the basic website/editor checks are retained as workflow artifacts.

The `/web-demos/*` headers retain cross-origin isolation for native sample pages. The current single-thread Haylen web player does not require SharedArrayBuffer or isolation. All native resources are served from the same static origin. Browser capabilities and hardware still govern WebGPU, WebGL2 and audio availability.

## Local browser playground

`/playground/` contains the editor. Its Lua/JSON syntax highlighting, project tree, file/folder operations, drag-and-drop imports, image previews, ZIP imports/exports and IndexedDB saves run locally. Play/Pause/Stop, hot reload and diagnostics talk to the actual editable Haylen player in a disposable iframe. The IDE has generic panels and never supplies game controls. Keyboard, pointer and touch input are implemented by the imported project. The activity rail toggles explorer, code, preview and console, while closing an editor tab preserves its file. Project ZIP import replaces the complete workspace after confirmation.

After installing the web SDK upstream (`haylen sdk build --target web`, which `demos:build` also runs), run `npm run playground:runtime -- --engine-dir ../haylen`. The command stages the four page-mode runtime files of the SDK's player under ignored `.cache/web-player/`, validates the complete WASM and version 1 of the editor contract, and records its digest, Git revision and SDK source revision. It does not rebuild or patch the engine. The site builder injects this player into `dist/playground/runtime/`. Production sets `HAYLEN_REQUIRE_PLAYGROUND_RUNTIME=1` and fails when it is missing or invalid; a website-only build retains editing/export with Play disabled.

The production workflow stages the player after sample compilation, validates its static bundle and publishes it in the same `dist/` upload. No extra Cloudflare service, API key, database or application server is needed.

The browser service worker caches only the playground and its runtime/shared assets. Wait for **Available offline** before disconnecting. First visits still require a download. Updates activate when old playground tabs close or through the update button in Help; they do not force-reload unsaved work. Files are local to this domain and browser profile. Export ZIPs as backups; clearing browser storage can remove the workspace and offline cache. Use one editing tab per workspace.

The preview talks to the player through Haylen's versioned editor contract. Each project is limited to 1,000 files and 64 MiB in the player as in the editor, and its saved data stays in a storage namespace apart from the gallery samples. The preview recovers ordinary Lua errors, and in development the player stops Lua code that runs past its execution budget with an error and a way to restart. A finalizer that never ends or a native loop can still hold the preview's single thread, so the preview is no hard sandbox. C++ and native plugin compilation still use Haylen's normal toolchain.

Run `npm run test:browser` for simple page-opening smoke checks. These do not execute games or app flows.

## Playground examples

The Examples menu loads complete editable projects from `src/data/playground-examples.json`. Photo Social is the default for new workspaces; existing saved projects are restored unchanged. Action Game remains available as a separate game example. All examples use version `1.0.0`. Switching projects confirms replacement and preserves a chance to export the current files first. All example files are included in the offline cache.

Help shows the build date and time in the browser's local time; its tooltip contains the exact UTC timestamp. Build details have no permanent bar in the editor. Online reloads revalidate IDE files with the server. Without a connection, the service worker falls back to a complete cached build. When a new offline build is ready, Update playground in Help saves the workspace, activates that build and reloads the page. It does not replace saved project files. The Auto update checkbox controls hot reload of the running project. Load an example again through Examples to receive its latest source. Browsers using the earlier cache-first worker may need to close all playground tabs once to activate this update.

Preview controls offer Fit, smartphone (390 × 844), tablet (768 × 1024) and desktop (1280 × 800) viewports. The existing app frame resizes without restarting and scales to fit the editor. Rotate swaps the viewport width and height without restarting the app. Choosing a preset restores its default orientation. These controls do not emulate physical device hardware. Hiding the console gives its space to the preview. Action Game uses K for dash and J for attacks, with controller and touch bindings kept in its project input file.

Photo Social is Haylen's Photo Social sample with a sign-in flow added, so it shows how an app moves between screens the way phone and tablet apps do. Signing in and out changes the whole app, so the sign-in flow and the main app are two scenes. Inside the main app the frame mounts once: the rail of a wide window or the bar of icons of a phone stays still while screens slide in the middle, each tab keeps its own stack and scroll, messages show the conversations beside the chat on a wide window, and a new post and the stories open over everything as flows with their own bars. The sign-in flow works the same way, with its picture staying beside the forms.

Sign in, account creation and password resets call [httpbin.org](https://httpbin.org), a public service for testing HTTP clients, over HTTPS from `source/services/accounts.lua`. Sign in uses HTTP Basic authentication and treats status 401 as a wrong password; the other two POST JSON and check the echoed answer. The demo account is `rosa@example.com` / `explore123`. Accounts and social records stay in memory during the running app session, and the sign-in screen asks people to use only the demo account.

## Search and social previews

The confirmed production origin is **https://haylenengine.com**, configured in `src/data/site.json`. The build generates absolute canonical and social URLs, unique page metadata, safely serialized Schema.org JSON-LD, `sitemap.xml` and the sitemap declaration in `robots.txt`. The social cover is a local PNG with measured dimensions. Gallery search/filter URLs share the canonical `/demos/` URL. The sitemap lists Home, About, Demos and Playground; the 404, native sample responses and playground player/frame are excluded from indexing.

Attach the domain to this Pages project and use HTTPS. After deployment, verify the domain in [Google Search Console](https://search.google.com/search-console) and submit `https://haylenengine.com/sitemap.xml`. Neither the build nor this repository submits it automatically. Inspect the four public page URLs with URL Inspection. Sitemaps and structured data help discovery and interpretation, but do not guarantee indexing, rich results or rankings. For domain changes, update the single site configuration and configure a permanent redirect at Cloudflare from the old domain.

References: [Google canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [Google sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [Open Graph](https://ogp.me/), [Schema.org SoftwareSourceCode](https://schema.org/SoftwareSourceCode).

The basic browser suite runs Chromium, Firefox and WebKit. On macOS the Firefox configuration uses isolated app-data directories under `.cache/firefox/`, avoiding access to personal browser data. The hero uses standard CSS/SVG animation with reduced-motion and no-JavaScript fallbacks. Tailwind CSS 4 requires modern browser versions ([compatibility](https://tailwindcss.com/docs/compatibility)); do not claim support for every historical browser version.

References: [Cloudflare limits](https://developers.cloudflare.com/pages/platform/limits/), [Direct Upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/), [Haylen distribution](https://github.com/haylen-org/haylen/blob/main/docs/tools/distribution.md), [Haylen protected content](https://github.com/haylen-org/haylen/blob/main/docs/content/content.md).

## Static sample startup

For Lua release pages, the site builder extends the generated `config.json` download list to include every existing protected-content shard. Haylen's own loader downloads those files, shows its normal progress and supplies their exact bytes to the runtime before it starts. This avoids the missing-chunk startup failure observed when a sample reads content synchronously before the background content store has acquired it. It changes no engine source, loader code or WASM. All original release files remain in their sample folder. These bounded public samples intentionally trade a larger initial download for reliable complete startup; this gallery does not claim to demonstrate streaming huge worlds. For the C++ sample, the builder adds a preload stage to the generated page bootstrap: it downloads the existing release files and writes them through Emscripten's exported `Module.FS` before the original runtime starts. The C++ WASM and generated data file stay unchanged. This also removes a dependency on byte-range response behavior during sample startup. Transparent sample pages receive a dark browser background suited to the website.
