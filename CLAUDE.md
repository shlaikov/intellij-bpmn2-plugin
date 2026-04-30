# CLAUDE.md

Project memory for Claude Code. IntelliJ plugin: BPMN 2.0 diagram viewer.

## Architecture

Two-layer plugin:

- **Kotlin host** (`src/main/kotlin/com/github/shlaikov/intellijbpmn2plugin/`) — IntelliJ FileEditor + JCEF browser panel
  - `editor/Editor.kt` — `FileEditor` impl, owns `WebView` lifecycle
  - `editor/WebView.kt` — wraps `LoadableJCEFHtmlPanel`, registers `https://bpmn2-plugin/*` scheme handler that serves built webview assets
  - `utils/LoadableJCEFHtmlPanel.kt` — JCEF panel + loading indicator
  - `utils/SchemeHandlerFactory.kt` — CEF scheme request handler
- **React webview** (`src/main/resources/webview/`) — Vite + React + bpmn-js renderer
  - `src/App.tsx` reads `window.bpmn2Data` (injected by Kotlin via `$$initialData$$` placeholder substitution)
  - `src/components/Viewer/` — bpmn-js NavigatedViewer wrapper
  - Built artifacts go to `src/main/resources/webview/dist/` (gitignored, generated)

`dist/index.html` template uses `$$initialColor$$` and `$$initialData$$` placeholders. `WebView.initializeSchemeHandler` substitutes them on every request.

## Build

```bash
# webview only
cd src/main/resources/webview && yarn build

# full plugin (also runs buildYarn task)
./gradlew buildPlugin
# artifact: build/distributions/intellij-bpmn2-plugin-<version>.zip

# sandbox IDE for manual testing
./gradlew runIde
```

Node ≥20 required (bpmn-js 17.x transitive `domify@3.0.0` engine constraint). Pinned in `build.gradle.kts` `node { version }` and `package.json` `volta`.

## Release flow

1. Bump `pluginVersion` in `gradle.properties`
2. Update `CHANGELOG.md` (Keep-a-Changelog format)
3. Commit, push to `main`
4. Tag `vX.Y.Z` and push tag
5. `build.yml` (push to main) creates **draft** release with built zip
6. User publishes draft via GH UI → `release.yml` runs `publishPlugin` to JetBrains Marketplace (needs `PUBLISH_TOKEN`, `PRIVATE_KEY`, `PRIVATE_KEY_PASSWORD`, `CERTIFICATE_CHAIN` secrets)

`runPluginVerifier` pinned to `IC-2024.1`/`2024.2`/`2024.3` — default behavior tries unreleased EAP IDEs.

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
- `importDiagram` in Viewer must `await bpmn-js importXML` and catch — it returns Promise, sync `try/catch` misses async rejections
- Don't introduce Jackson XML or kotlin-module-jackson; default `jacksonObjectMapper()` works fine for the tiny `InitialData` payload
