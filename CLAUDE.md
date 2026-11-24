# CLAUDE.md

Project memory for Claude Code. IntelliJ plugin: BPMN 2.0 and DMN viewer (read-only).

## Architecture

Two-layer plugin; each layer has one seam where a diagram format plugs in.

- **Kotlin host** (`src/main/kotlin/com/github/shlaikov/intellijbpmn2plugin/`) — IntelliJ FileEditor + JCEF browser panel
  - `diagram/DiagramKind.kt` — **the** list of supported formats (BPMN, DMN): id shared with the webview, file-name suffixes, icon. `EditorProvider`, `IconProvider` and `WebView` all go through `DiagramKind.of(file)`; matching is by file name, not by registered `FileType`
  - `editor/Editor.kt` — `FileEditor` impl, owns the `WebView` and the file's `Document`; the page is rendered from the document text (unsaved edits included, not the file on disk — saving happens on the IDE's schedule and made the diagram lag). Reloads are debounced (300 ms) on document change, VFS change and theme change; while the diagram is not showing the reload is deferred to `selectNotify()`
  - `editor/WebView.kt` — one page: `LoadableJCEFHtmlPanel` + JS query for webview→host messages; renders `index.html` for its file
  - `editor/DiagramResources.kt` — the single CEF scheme handler factory for `https://bpmn2-plugin`, serves `webview/dist` and routes by editor id (see below)
  - `editor/WebMessage.kt` — hand-rolled JSON (`toJsonString`, `IncomingMessage.parse`)
  - `utils/LoadableJCEFHtmlPanel.kt` — JCEF panel + loading indicator + wheel/pinch forwarding
- **React webview** (`src/main/resources/webview/`) — Vite + React shell, bpmn-js / dmn-js renderers
  - `src/renderers/types.ts` — `DiagramRenderer`, the contract the shell depends on; `bpmn.ts` and `dmn.ts` implement it, `index.ts` maps kind → lazy `import()` so a page loads only its own library
  - `src/renderers/canvasNavigation.ts` — zoom/scroll/pinch over a diagram-js canvas, shared by BPMN and the DMN DRD
  - `src/host/bridge.ts` — the only code that touches `window.bpmn2Data`, `sendMessageToHost`, `bpmn2Wheel`, `bpmn2Pinch`
  - `src/components/DiagramView/` — format-agnostic shell: renderer lifecycle, `ViewTabs` (multi-view documents), `ZoomBar` (only when the active view is a canvas), `ErrorBar`
  - Built artifacts go to `src/main/resources/webview/dist/` (gitignored, generated). `processResources` packages **only** `webview/dist` — sources and `node_modules` are excluded (with them the jar was 36 MB and Plugin Verifier ran for 25+ minutes)

Adding a format: a `DiagramKind` entry + `fileType` in `plugin.xml` + icons, and a renderer registered in `src/renderers/index.ts`. Nothing else should need to know.

### Resource routing

CEF scheme handler factories are registered per (scheme, domain) for the **whole application**, not per browser. A factory closing over one editor answers for every tab (this was a real bug: saving file A reloaded its tab with file B). So `DiagramResources` is one shared factory and every editor gets `https://bpmn2-plugin/editor/<id>/index.html`; the id selects the session that renders `index.html`, everything else under the prefix is a static asset. The webview is built with `base: "./"` so asset and lazy-chunk URLs stay under that prefix. `DiagramResources.install()` is called from every browser's `onAfterCreated` (CEF must be up; re-registering the same object is harmless).

`dist/index.html` uses `$$initialColor$$`, `$$initialData$$` and `$$sendToHost$$` placeholders, substituted in `WebView.renderIndex` on every load (one regex pass, so file text is never rescanned) with the current document text, kind, theme and the JS-query call.

`window.sendMessageToHost` is therefore part of the page. Don't go back to injecting it with `executeJavaScript` from `onLoadEnd`: that races with the page's own code and on a fast reload the script can miss the new document entirely — the page then queues `init` forever and the loading indicator never goes away (observed on 2025.2, roughly every other reload). Changes reach the page by reloading it (`Editor` → `WebView.reload()`), not by messaging.

### Lifecycle

Everything hangs off the `Disposer` tree: `Editor` → `WebView` → `LoadableJCEFHtmlPanel` → `JCEFHtmlPanel`. Don't use `com.jetbrains.rd` lifetimes (an IDE-classpath library, same risk as Jackson in #37) and don't `messageBus.connect()` without a parent. The webview signals `{"event":"init"}` once the document is rendered or has failed; the host drops its loading indicator on it.

### DMN specifics

- Viewer only: `dmn-js/lib/NavigatedViewer`. One document has several views (DRD, decision tables, literal/boxed expressions) → `ViewTabs`; dmn-js keeps one viewer instance per view *type*.
- dmn-js reads DMN 1.3 only; `@bpmn-io/dmn-migrate` upgrades 1.1/1.2 in memory before import.
- Theming: DRD shape colours via `drd.drdRenderer` config, everything else via the `--bio-*` CSS tokens overridden in `src/renderers/dmn.css` under `.theme-dark`.
- dmn-js pulls diagram-js 15 to the top of `node_modules` while bpmn-js 17 keeps its own nested 14.x. Never import `diagram-js/...` directly from app code for BPMN — use what `bpmn-js/lib/NavigatedViewer` already bundles.
- The icon font comes from `dmn-font/css/dmn-embedded.css` (inlined), so no font files need serving.

## Build

```bash
# webview only
cd src/main/resources/webview && yarn build
# lockfile is Yarn 4 (berry); without a global yarn: npx @yarnpkg/cli-dist@4.2.2 <cmd>
# `yarn dev` shows a sample without the IDE: ?kind=dmn&theme=dark

# full plugin (also runs buildYarn task)
./gradlew buildPlugin
# artifact: build/distributions/intellij-bpmn2-plugin-<version>.zip

# sandbox IDE for manual testing
./gradlew runIde
```

`runIde` is **useless for the viewer on macOS**: `useInstaller = false` resolves the IDE from Maven, and that artifact has no JCEF native binaries (`Startup JCEF test is failed (because CefApp wasn't initialized)` in the sandbox `idea.log`), so every diagram is a blank panel. `local("/Applications/IntelliJ IDEA.app")` does not help either — IJP 2.5.0 fails to start a 2026.2 install (`ClassNotFoundException: MultiRoutingFileSystemProvider`). What works: `./gradlew buildPlugin`, unzip `build/distributions/*.zip` into an empty plugins dir and start an installed IDE with isolated directories via an `IDEA_PROPERTIES=<file>` env var whose file sets `idea.config.path`, `idea.system.path`, `idea.plugins.path`, `idea.log.path` (plus `idea.trust.all.projects=true`, `idea.log.debug.categories=#com.github.shlaikov.intellijbpmn2plugin`). Don't use `JAVA_TOOL_OPTIONS` — the IDE shows a warning about it.

With that debug category on, `idea.log` shows every request served (`editor <id>: serving …`), `webview is ready`, and the page's own console (`console […]`), which is enough to check routing and reloads without looking at the window.

Node ≥20 required (bpmn-js 17.x transitive `domify@3.0.0` engine constraint). Pinned in `build.gradle.kts` `node { version }` and `package.json` `volta`.

## Release flow

1. Bump `pluginVersion` in `gradle.properties`
2. Update `CHANGELOG.md` (Keep-a-Changelog format)
3. Commit, push to `main`
4. Tag `vX.Y.Z` and push tag
5. `build.yml` (push to main) creates **draft** release with built zip
6. User publishes draft via GH UI → `release.yml` runs `publishPlugin` to JetBrains Marketplace (needs `PUBLISH_TOKEN`, `PRIVATE_KEY`, `PRIVATE_KEY_PASSWORD`, `CERTIFICATE_CHAIN` secrets)

`verifyPlugin` pinned to IC `2025.1`, `2025.2` (installers) and `2026.1.5`, `2026.2.3`, `2026.3` (`useInstaller = false`, Maven artifacts — IJP 2.5.0 can't locate the renamed 2026.x installer dmgs; same reason `create(...)` uses `useInstaller = false`). Don't use EAP snapshots for `platformVersion`: JetBrains GC's them and the build silently breaks later (happened with `262.6228.19-EAP-SNAPSHOT`); always a released version like `2026.2.3`. Minimum supported IDE is 2025.1 (`pluginSinceBuild = 251`): resource serving delegates to platform `com.intellij.ui.jcef.utils.JBCefStreamResourceHandler`, which only exists in 2025.1+.

`buildYarn` on macOS fails *after* producing `webview/dist` with a configuration-cache error (`uname -m` from the node plugin). The dist is still built; CI (Linux) is unaffected.

## JCEF dependency (2026.2+)

Since IntelliJ 2026.2 JCEF is a separate bundled plugin, *Web Browser (JCEF)*, id `com.intellij.modules.jcef`. Without declaring it the plugin classloader can't see `com.intellij.ui.jcef.*` → `NoClassDefFoundError: JCEFHtmlPanel` (#35). Declared in `plugin.xml` as `<depends optional="true" config-file="bpmn2-jcef.xml">` — **optional on purpose**: the id only exists since 2025.3.1, a hard `<depends>` would stop the plugin loading on 2025.1 – 2025.3.0. `bpmn2-jcef.xml` is intentionally empty; all extensions stay in `plugin.xml`. `build.gradle.kts` adds `bundledPlugin("com.intellij.modules.jcef")` for the compile classpath. Known consequence: on 2026.2+ with the Web Browser (JCEF) plugin disabled the editor fails the same way — acceptable. Plugin Verifier reports the unresolved optional dependency on 2025.x as info, not an error.

## Wheel and pinch in OSR mode

JCEF out-of-process mode (`ide.browser.jcef.out-of-process.enabled`, default on since 2025.1) forces off-screen rendering; `JCEFHtmlPanel(false, …)` is ignored with a warning. In OSR the platform forwards AWT wheel events to CEF itself (`JBCefOsrComponent.processMouseWheelEvent`): rotation ×40 rounded to int, Shift+wheel (how macOS reports horizontal trackpad scrolling) becomes `deltaX`+`shiftKey`, which diagram-js ignores, and JBR touch-scroll events are dropped by the remote browser. So when `isOffScreenRendering` is true `LoadableJCEFHtmlPanel` adds its own `MouseWheelListener` on the browser UI component, consumes the event (the platform path checks `isConsumed`) and calls `window.bpmn2Wheel(dx, dy, x, y, ctrl, meta)` in the webview (`host/bridge.ts`), which drives `zoomScroll` directly through `CanvasNavigation`. Because the native event is consumed, views that are plain HTML (DMN decision tables, where `renderer.navigation()` is `null`) would not scroll at all — for those the bridge scrolls the nearest scrollable element under the pointer. Measured on macOS JBR: trackpad gives `preciseWheelRotation` in 0.1 steps per point with `scrollAmount` 1, horizontal and vertical come as separate events; `WHEEL_UNIT_PX = 10` makes it 1:1.

Pinch: AWT has no wheel mapping for magnify and OSR Chromium gets no native input. The IDE's `MacGestureAdapter` looks for a `com.intellij.ui.components.ZoomableViewport` ancestor under the pointer; `multiPanel` implements it and forwards start/move/end to `window.bpmn2Pinch`, where `canvas.zoom(start * exp(magnification), at)` is applied. `magnificationStarted` fires twice per gesture on 2026.2, harmless. Raw events can be logged with `idea.log.debug.categories=#com.github.shlaikov.intellijbpmn2plugin`.

## Marketplace compliance

Approval guidelines: https://plugins.jetbrains.com/docs/marketplace/jetbrains-marketplace-approval-guidelines.html

Must keep:
- `<vendor>` with `email` + `url` attrs in `plugin.xml`
- Plugin Verifier passing (no internal API usage)
- 40x40 SVG icon at `META-INF/pluginIcon.svg` (not template default)
- Real changelog entries (no `Add change notes here` placeholder)
- README `<!-- Plugin description -->` block clean (rendered as marketplace description)

Marketplace plugin id: `21952` (URL: https://plugins.jetbrains.com/plugin/21952).

## Known limitations

- **Dark theme white flash on first BPMN tab open**: JCEF heavyweight native window paints CEF-default white before HTML loads. `setPageBackgroundColor` and AWT bg don't cover it on macOS. OSR mode (`JCEFHtmlPanel(true, ...)`) eliminates flash but cripples touchpad pan/zoom (CPU-bound image rendering). Windowed mode is the trade-off — flash appears once per IDE session, second open is fine (browser warmed up).
- **CDATA in BPMN**: previously broke via faulty regex stripper. Fixed by removing `removeCDATA` — bpmn-js saxen parser handles CDATA natively. Don't reintroduce manual CDATA stripping.

## Conventions

- Kotlin: 4-space indent (existing), 2-space in `build.gradle.kts`
- React/TS: 2-space, prefer `async/await` for promises
- Renderer `open()` must `await` the library's `importXML` — it returns a Promise, sync `try/catch` misses async rejections; `DiagramView` catches and shows the error
- One renderer instance per mount, `destroy()` in the effect cleanup; never create a viewer in an effect without dependencies
- Values sent to the webview carry explicit ids (`DiagramKind.id`, `Theme.id`) — never `name.lowercase()` with the default locale (Turkish `I` → `ı`)
- `yarn lint` has never worked: ESLint 8 does not read `.eslintrc.ts`
- No JSON library on the Kotlin side — not Jackson, Gson or kotlinx.serialization from the IDE classpath. Which libraries the platform exposes to plugins changes between releases: `jacksonObjectMapper()` worked until 2026.3 dropped `jackson-module-kotlin` from the plugin classloader (`NoClassDefFoundError`, #37). `InitialData.toJson()` / `String.toJsonString()` and `IncomingMessage.parse` in `editor/WebMessage.kt` hand-roll the tiny payloads; `toJsonString` also escapes `<`, `>`, `&` because the JSON is inlined into a `<script>` block
