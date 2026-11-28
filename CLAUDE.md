# CLAUDE.md

Project memory for Claude Code. IntelliJ plugin: BPMN 2.0 and DMN viewer (read-only), with a visual diff of two versions.

## Architecture

Two-layer plugin; each layer has one seam where a diagram format plugs in.

- **Kotlin host** (`src/main/kotlin/com/github/shlaikov/intellijbpmn2plugin/`) — IntelliJ FileEditor + JCEF browser panel
  - `diagram/DiagramKind.kt` — **the** list of supported formats (BPMN, DMN): id shared with the webview, file-name suffixes, icon. `EditorProvider`, `IconProvider` and `WebView` all go through `DiagramKind.of(file)`; matching is by file name, not by registered `FileType`
  - `editor/Editor.kt` — `FileEditor` impl, owns the `WebView` and the file's `Document`; the page is rendered from the document text (unsaved edits included, not the file on disk — saving happens on the IDE's schedule and made the diagram lag). Reloads are debounced (300 ms) on document change, VFS change and theme change; while the diagram is not showing the reload is deferred to `selectNotify()`
  - `editor/WebView.kt` — one page: `LoadableJCEFHtmlPanel` + JS query for webview→host messages; renders `index.html` with the `window.bpmn2Data` JSON its owner supplies (`InitialData.viewer` / `InitialData.diff` in `WebMessage.kt`). It knows nothing about files: `Editor` and `DiagramDiffViewer` are its two owners
  - `diff/` — the comparison in the IDE's diff window, see "Diff" below
  - `editor/DiagramResources.kt` — the single CEF scheme handler factory for `https://bpmn2-plugin`, serves `webview/dist` and routes by editor id (see below)
  - `editor/WebMessage.kt` — hand-rolled JSON (`toJsonString`, `IncomingMessage.parse`)
  - `utils/LoadableJCEFHtmlPanel.kt` — JCEF panel + loading indicator + wheel/pinch forwarding
- **React webview** (`src/main/resources/webview/`) — Vite + React shell, bpmn-js / dmn-js renderers
  - `src/formats/` — everything format-specific, one folder per format: `bpmn/` and `dmn/` each hold a `renderer.ts` (how a document is shown) and a `differ.ts` (how two are compared)
    - `index.ts` — the registry and the only entry point for the shell: `isDiagramKind`, `loadRenderer(kind)`, `compare(kind, before, after)`; kind → lazy `import()`, so a page loads only its own library and only a comparison loads a differ
    - `types.ts` — the contracts the shell depends on: `DiagramRenderer`, and `Change` / `Diff` / `Differ`; `changes.ts` — helpers the differs share
    - `canvas/` — what BPMN and the DMN DRD have in common as diagram-js canvases: `navigation.ts` (zoom/scroll/pinch, viewbox, planes), `marks.ts` (change highlighting)
  - `src/host/bridge.ts` — the only code that touches `window.bpmn2Data`, `sendMessageToHost`, `bpmn2Wheel`, `bpmn2Pinch`
  - `src/hooks/useDiagram.ts` — the lifecycle of one renderer (create, open, destroy); a page has one (`DiagramView`) or two (`DiffView`)
  - `src/components/DiagramView/` — format-agnostic shell: `ViewTabs` (multi-view documents), `ZoomBar` (only when the active view is a canvas), `ErrorBar`
  - `src/components/DiffView/`, `ChangeList/` — the comparison page, see "Diff" below
  - Built artifacts go to `src/main/resources/webview/dist/` (gitignored, generated). `processResources` packages **only** `webview/dist` — sources and `node_modules` are excluded (with them the jar was 36 MB and Plugin Verifier ran for 25+ minutes)

Adding a format: a `DiagramKind` entry + `fileType` in `plugin.xml` + icons, and a folder in `src/formats/` with a renderer and a differ, registered in `src/formats/index.ts`. Nothing else should need to know.

### Rules

What the structure is for; a change that needs to break one of these is a change of architecture and gets discussed first.

1. **The host is a shell, the page does the work.** Kotlin delivers text, kind and theme, forwards input and owns lifecycle. It never parses a diagram. Everything about BPMN or DMN is in the webview.
2. **A format plugs in at one place per layer**: `DiagramKind` on the host, `src/formats/index.ts` in the webview. Code outside them does not branch on the format.
3. **Data goes one way.** Host → page: the whole state as `window.bpmn2Data` on (re)load, never incremental messages. Page → host: flat JSON events (`{"event":"init"}`). Host → page calls exist for input only (`bpmn2Wheel`, `bpmn2Pinch`). All of it passes through `host/bridge.ts` and `editor/WebMessage.kt`, and what arrives is untrusted until validated (`App.tsx`).
4. **Webview dependencies point inwards**: `components` → `hooks` → `formats`, and `host`, `utils` on the side.
   - The shell imports `formats/index.ts` (functions) and `formats/types.ts`, `formats/canvas/navigation.ts` (types); never a format's folder.
   - `formats/<format>/` imports `../types`, `../changes`, `../canvas` and its libraries; never another format, a component, a hook or `host/`.
   - bpmn-js, dmn-js and their companions are imported only inside `formats/<format>/`, so each stays in its lazy chunk.
   - `utils/` is leaf code without dependencies on the rest; it is not a place for things that have a home.
5. **Host packages by role**: `diagram` (what a format is; depends on nothing), `editor` and `diff` (the two entry points; they do not depend on each other), the page infrastructure both use, and small extension points (`actions`, `icons`, `notifications`).
6. **Everything has an owner in the `Disposer` tree** (see Lifecycle); nothing is cleaned up by hand elsewhere.
7. **Only public, long-lived platform API**: nothing `@ApiStatus.Internal`, nothing newer than 2025.1 without a guard, no library borrowed from the IDE classpath. `verifyPlugin` is the gate. A class the platform instantiates everywhere (an extension) must load without JCEF.

### Resource routing

CEF scheme handler factories are registered per (scheme, domain) for the **whole application**, not per browser. A factory closing over one editor answers for every tab (this was a real bug: saving file A reloaded its tab with file B). So `DiagramResources` is one shared factory and every editor gets `https://bpmn2-plugin/editor/<id>/index.html`; the id selects the session that renders `index.html`, everything else under the prefix is a static asset. The webview is built with `base: "./"` so asset and lazy-chunk URLs stay under that prefix. `DiagramResources.install()` is called from every browser's `onAfterCreated` (CEF must be up; re-registering the same object is harmless).

`dist/index.html` uses `$$initialColor$$`, `$$initialData$$` and `$$sendToHost$$` placeholders, substituted in `WebView.renderIndex` on every load (one regex pass, so file text is never rescanned) with the current document text, kind, theme and the JS-query call.

`window.sendMessageToHost` is therefore part of the page. Don't go back to injecting it with `executeJavaScript` from `onLoadEnd`: that races with the page's own code and on a fast reload the script can miss the new document entirely — the page then queues `init` forever and the loading indicator never goes away (observed on 2025.2, roughly every other reload). Changes reach the page by reloading it (`Editor` → `WebView.reload()`), not by messaging.

### Diff

`diff/DiagramDiffTool` is a `FrameDiffTool` registered as `diff.DiffTool`, so it shows up as one more viewer wherever the IDE compares two contents; no Git4Idea dependency. It fits a `ContentDiffRequest` whose two sides are `DocumentContent`/`EmptyContent` (added or deleted file) of one `DiagramKind`. The kind is taken from the *name*: `DiffUserDataKeysEx.FILE_NAME` first — a VCS revision is not a `FileContent`, and for a deleted or renamed file it has no highlight file either. `canShow` runs on every update of the viewer chooser: names only, never the text.

- The tool is instantiated in every IDE, also where the optional JCEF dependency is missing, and must stay in `plugin.xml` (`bpmn2-jcef.xml` is not loaded on 2025.1 – 2025.3.0). So `DiagramDiffTool` mentions no JCEF type; `diff/Jcef.kt` is the one guarded check.
- Which viewer opens first is the platform's business (`DiffSettings`, per "place"): text stays first in Local Changes, file history and the Git log, ours is first in standalone compares, and the user's switch is remembered. Don't fight it with `SuppressiveDiffTool` (removes the text viewers) or `DiffToolSubstitutor` (internal).
- The diff window creates a `DiagramDiffViewer` per request and per viewer switch and disposes it itself; everything hangs off the viewer. `ToolbarComponents`: set `popupActions` only (`rightToolbarActions` does not exist in 2025.1).
- Page: `DiffView` runs two renderers and compares what they hold — `DiagramRenderer.definitions()`, never a second parse. `formats/bpmn/differ.ts` adapts `bpmn-js-differ`; `formats/dmn/differ.ts` is our own. The result is a list of changes plus marks per side, applied through `DiagramRenderer.setMarks` (canvas: classes via `formats/canvas/marks.ts`, styled in `DiffView/markers.css`; decision tables: a generated style sheet over `data-row-id` / `data-col-id` / `data-element-id`, because dmn-js re-renders the HTML at will).
- DMN ids are not reliable: `dmn-migrate` gives every id-less element of a 1.1 file a *random* id, different in each pane. Hence the differ works on each pane's own tree and pairs table clauses and rules by content, then position, when their ids have nothing in common.
- The panes are linked by copying the viewbox on `canvas.viewbox.changed` (both versions share a coordinate space) and the root on `root.set` (drill-down into a collapsed sub-process), below the library's own listeners. Panes must be the same size for that to look right. `installInput` routes wheel and pinch to the pane under the pointer.
- `idea diff a.bpmn b.bpmn` (with the isolated `IDEA_PROPERTIES` below) opens a comparison without clicking; closing that window logs a platform `Access is allowed from write thread only` from `DiffApplication`, not ours.

### Lifecycle

Everything hangs off the `Disposer` tree: `Editor` → `WebView` → `LoadableJCEFHtmlPanel` → `JCEFHtmlPanel`. Don't use `com.jetbrains.rd` lifetimes (an IDE-classpath library, same risk as Jackson in #37) and don't `messageBus.connect()` without a parent. The webview signals `{"event":"init"}` once the document is rendered or has failed; the host drops its loading indicator on it.

### DMN specifics

- Viewer only: `dmn-js/lib/NavigatedViewer`. One document has several views (DRD, decision tables, literal/boxed expressions) → `ViewTabs`; dmn-js keeps one viewer instance per view *type*.
- dmn-js reads DMN 1.3 only; `@bpmn-io/dmn-migrate` upgrades 1.1/1.2 in memory before import.
- Theming: DRD shape colours via `drd.drdRenderer` config, everything else via the `--bio-*` CSS tokens overridden in `src/formats/dmn/dmn.css` under `.theme-dark`.
- dmn-js pulls diagram-js 15 to the top of `node_modules` while bpmn-js 17 keeps its own nested 14.x. Never import `diagram-js/...` directly from app code for BPMN — use what `bpmn-js/lib/NavigatedViewer` already bundles.
- The icon font comes from `dmn-font/css/dmn-embedded.css` (inlined), so no font files need serving.

## Build

```bash
# webview only
cd src/main/resources/webview && yarn build
# lockfile is Yarn 4 (berry); without a global yarn: npx @yarnpkg/cli-dist@4.2.2 <cmd>
# `yarn dev` shows a sample without the IDE: ?kind=dmn&theme=dark, and ?diff (=added, =broken) a comparison

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

`buildYarn` on macOS fails *after* producing `webview/dist` with a configuration-cache error (`uname -m` from the node plugin). The dist is still built; CI (Linux) is unaffected. Locally it also runs Yarn classic, which rewrites `yarn.lock` in v1 format (thousands of changed lines): `git checkout` the lockfile afterwards, and add dependencies with Yarn 4 (`npx @yarnpkg/cli-dist@4.2.2 add …`) only.

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

## Code style

English everywhere: identifiers, comments, docs, commit messages, UI strings.

### Both languages

- Names say what a thing is for, in the vocabulary already in use: *kind* (format), *view* (one openable part of a document), *pane* (one side of a comparison), *marks*, *change*. No `Impl`, `Manager`, `Helper`, `Utils` classes.
- A comment gives the reason, the constraint or the trap — what the code cannot say. Doc comment on every exported/public declaration that is not self-evident; when a line exists because something broke, say what broke (see `WebView.renderIndex`, `DiagramResources`). No comments that restate the code, no commented-out code, no TODOs without an issue.
- Small files with one responsibility; a file is named after the one thing it exports. Early returns with braces, a blank line before `return` and between logical steps.
- No dead flexibility: no options, parameters or abstractions without a second user. Three similar lines beat a premature helper; the second real use is when to extract.
- Values sent across the bridge carry explicit ids (`DiagramKind.id`, `Theme.id`) — never `name.lowercase()` with the default locale (Turkish `I` → `ı`).

### Kotlin

- 4-space indent (2 in `build.gradle.kts`), `.editorconfig` is the reference; no formatter or linter runs in the build, Qodana in CI is advisory.
- `internal` unless the platform must see the class (extensions registered in `plugin.xml` are public). `private companion object` for `LOG` and constants.
- Expression bodies for one-liners; `checkNotNull`/`requireNotNull` with a message instead of `!!`.
- Platform types at the boundary are made explicit (`String?`), and what crosses threads is an immutable snapshot: the page data supplier runs on a CEF thread and reads `document.immutableCharSequence`; UI work goes through `invokeLater`.
- Logging: `LOG.debug { "$name: …" }` with the page name first, so `idea.log` can be filtered per page; `warn` for what a user would want reported, never `error` for something the page can show itself.
- User-visible strings come from `BPMN2Bundle`.
- No JSON library — not Jackson, Gson or kotlinx.serialization from the IDE classpath. Which libraries the platform exposes to plugins changes between releases: `jacksonObjectMapper()` worked until 2026.3 dropped `jackson-module-kotlin` from the plugin classloader (`NoClassDefFoundError`, #37). `InitialData` / `String.toJsonString()` and `IncomingMessage.parse` in `editor/WebMessage.kt` hand-roll the tiny payloads; `toJsonString` also escapes `<`, `>`, `&` because the JSON is inlined into a `<script>` block.

### TypeScript and React

- Formatting is Prettier's (`"prettier"` in `package.json`: defaults plus `printWidth: 120`): 2 spaces, double quotes, semicolons. `yarn format` before committing; `exampleDiagram.ts` is exempt. `yarn build` (`tsc` in strict mode) is the gate. `yarn lint` has never worked: ESLint 8 does not read `.eslintrc.ts`.
- Function components declared with `function`, one per folder: `components/Name/index.tsx` + `style.css`, props as `interface Props`, `export default`. Default exports are for components and for what `formats/index.ts` loads lazily (a format's `renderer.ts`, `differ.ts`); everything else is a named export.
- `interface` for object shapes, `type` for unions and function types, `import type` when only types are needed. No `any` outside `types/*.d.ts`; data from outside is `unknown` until checked. Declarations for untyped libraries live in `types/` and cover only what is used.
- State stays local (`useState`, `useRef`); no store, no context until something needs to cross more than a component or two. Logic with a lifecycle goes into a hook (`hooks/useDiagram.ts`), logic without React into `formats/` or `utils/`.
- `async/await` for promises. An effect that starts async work keeps a `disposed` flag and checks it after every `await`; errors are normalised to `Error` and shown, not swallowed.
- Renderer `open()` must `await` the library's `importXML` — it returns a Promise, sync `try/catch` misses async rejections; the shell catches and shows the error.
- One renderer instance per mount, `destroy()` in the effect cleanup; never create a viewer in an effect without dependencies.
- A `react-hooks/exhaustive-deps` suppression needs the reason to be evident from the comment above the effect.

### CSS

- Plain CSS next to its component, BEM with the `io-` prefix: `io-block__element--modifier`. Classes of the libraries (`djs-*`, `dmn-*`, `bjs-*`) are styled only where a format or the comparison needs it (`formats/dmn/dmn.css`, `DiffView/markers.css`).
- Colours are custom properties defined on `.io-diagram-view` (and `.io-diff`) with a `.theme-dark` variant; component rules use `var(--…)`, not literals. The theme is fixed per page load.
- Layout by flexbox; `position: fixed` only for what belongs to the page rather than to a pane.

### Docs and commits

- `CHANGELOG.md`: Keep a Changelog; every entry is a full sentence about what the user sees, with the issue number. The latest section becomes the Marketplace change notes.
- `README.md`: the `<!-- Plugin description -->` block is the Marketplace description — features as `- Name: description.`
- `CLAUDE.md`: decisions and traps with their reasons, not a description of what the code already says. A rule that stops being true is removed in the same change.
- Commits: one imperative subject line saying what changes for the user or the build, issue reference at the end (`Add DMN support (#29)`); `Release X.Y.Z: …` for releases, `CI: …` for workflow changes.

### Known deviations

To be brought in line when the code is next touched, not copied:

- The page infrastructure shared by `editor` and `diff` (`WebView`, `DiagramResources`, `WebMessage`, `Theme` in `editor/`, `LoadableJCEFHtmlPanel` in `utils/`, `diff/Jcef.kt`) has no package of its own, so `diff` imports from `editor`. Its home is a `webview` package; `utils/` then goes away.
- `Language.kt` (languages and file types) sits in the root package; it belongs with `diagram/DiagramKind.kt`.
- `ZoomBar` and `ErrorBar` use literal colours (and `filter: invert` for the dark theme) instead of the theme variables.
- Hard-coded UI strings: the editor name `"Diagram"` in `Editor.kt`, the action text in `plugin.xml`; all page texts (the webview has no localisation at all).
- `RatingNotification` uses brace-less one-line `if`s; `EditorProvider`, `Editor` and `OpenDevtoolsAction` have two blank lines after the imports.
- No automated tests run: `compileTestKotlin` and `test` are disabled in `build.gradle.kts`, the webview has no test runner. Checks are `tsc`, `verifyPlugin` and the manual runs described under Build.
