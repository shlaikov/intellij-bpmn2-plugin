<!-- Keep a Changelog guide -> https://keepachangelog.com -->

# intellij-bpmn2-plugin Changelog

## [Unreleased]

## [1.3.0] - 2026-11-24

### Added

- DMN support (#29): `.dmn` files open in the viewer, rendered with dmn-js. The decision requirements diagram, decision tables, literal and boxed expressions are shown in separate tabs; the diagram supports the same zoom, pan and pinch navigation as BPMN, and tables scroll with the wheel or trackpad. DMN 1.1 and 1.2 files are upgraded to 1.3 in memory for display. Follows the IDE theme.
- A file icon and XML highlighting for `.dmn` files.

### Fixed

- With several diagrams open, saving a file or switching the IDE theme could reload a tab with the contents of another file: the page handler was registered globally and the last opened editor answered for all of them. Each editor now has its own address.
- The loading indicator could stay over the diagram after the file was saved: the page reported that it had finished rendering through a function the IDE injected after the load event, which a fast reload could miss. The function is now part of the page.
- Clicking a link inside the viewer (the bpmn.io logo) opened it in an embedded browser window and left the diagram behind a loading indicator forever. Links now open in the system browser.
- Closing a diagram tab did not release its embedded browser or its IDE event subscriptions.
- The viewer page re-created the bpmn-js instance on every render and never destroyed the previous one.
- The theme was not recognised by the viewer when the IDE runs with a Turkish locale.
- The diagram lagged behind the text: it was rebuilt only when the IDE saved the file, so an edit (or the fix for a broken file) could take many seconds to show up. It now follows the text as it is typed, including unsaved changes, and also refreshes when the file changes on disk outside the IDE.

### Changed

- The plugin is now called **BPMN & DMN Viewer - Free and OpenSource**.
- The viewer loads only the library needed for the opened file (bpmn-js or dmn-js).
- The plugin archive contains only the built viewer; its sources (and, in local builds, `node_modules`) are no longer packaged. The download shrinks from about 24 MB to under 1 MB.
- No longer depends on the `rd` library from the IDE classpath for lifecycle handling; uses the platform `Disposer`.
- Stop using the deprecated `DynamicBundle(String)` constructor (Plugin Verifier warning on IntelliJ IDEA 2026.3); the message bundle is now created with its owning class.

## [1.2.5] - 2026-11-16

### Fixed

- `NoClassDefFoundError: com/fasterxml/jackson/module/kotlin/ExtensionsKt` on IntelliJ IDEA 2026.3 when opening a BPMN file (#37). The plugin relied on the Jackson Kotlin module that older IDEs happened to expose to plugins; 2026.3 no longer does. Jackson is no longer used at all: the small payload exchanged with the viewer is serialized by the plugin itself, so the same build works on 2025.1 – 2026.3.
- A BPMN file containing `</script>` or `<!--` in its text (e.g. inside documentation or a script task) could break the viewer page; such characters are now escaped when the file is handed to the viewer.

### Changed

- Plugin Verifier now also checks IntelliJ IDEA 2026.3.

## [1.2.4] - 2026-10-22

### Fixed

- `NoClassDefFoundError: com/intellij/ui/jcef/JCEFHtmlPanel` on IntelliJ IDEA 2026.2+ when opening a BPMN file (#35). Since 2026.2 JCEF ships as a separate bundled plugin (*Web Browser (JCEF)*, `com.intellij.modules.jcef`); the plugin now declares that dependency. It is declared as optional so the same build keeps working on 2025.1 – 2025.3, where JCEF is still part of the core platform.
- Trackpad and mouse-wheel navigation in off-screen JCEF mode (forced on 2026.2+ and most 2025.x setups): horizontal two-finger scrolling did nothing and vertical scrolling was jumpy because the platform forwards wheel events to CEF with an integer-rounded ×40 delta and puts macOS horizontal scrolling into `deltaX` + `shiftKey`, which diagram-js ignores. The plugin now intercepts wheel events itself and feeds precise deltas to the viewer.
- macOS trackpad pinch-to-zoom now zooms the diagram around the pointer (delivered through the IDE's gesture support via `ZoomableViewport`; JCEF never receives the gesture).

### Changed

- Build against the released 2026.2.3 SDK instead of the 262 EAP snapshot (which is no longer available in the JetBrains repository).
- Plugin Verifier now also checks IntelliJ IDEA 2026.1 and 2026.2 in addition to 2025.1 and 2025.2.

## [1.2.3] - 2026-06-13

### Fixed

- Plugin Verifier "class not found" (`CefResourceReadCallback`, `CefResourceSkipCallback`, `LongRef`) on IntelliJ IDEA 2026.1: stop hand-implementing JCEF `CefResourceHandler` and delegate resource serving to the platform's own `com.intellij.ui.jcef.utils.JBCefStreamResourceHandler`, which JetBrains compiles per IDE build against whichever `CefResourceHandler` shape exists. Clean verification across 2024.1 – 2026.2 and no more deprecated-API warnings.
- Drop internal-API usage `EditorBundle.message(...)` (flagged by the verifier) in favour of a plugin-owned timeout string.

### Changed

- Raise minimum supported IDE to 2025.1 (`pluginSinceBuild` 241 → 251). `JBCefStreamResourceHandler` was introduced in 2025.1; 2024.1–2024.3 lack it. Those users keep the last compatible published 1.2.x build.

## [1.2.2] - 2026-05-24

### Fixed

- Hotfix: revert `SchemeHandlerFactory` to the 1.2.0 anonymous-class implementation. The 1.2.1 `java.lang.reflect.Proxy` refactor caused diagrams to load indefinitely on IntelliJ IDEA 2026.1.2 (Windows). The dual override (`processRequest`/`readResponse` for older JCEF, `open`/`read`/`skip` for 2026.2+) is restored, accepting cosmetic Marketplace verifier warnings on 2025.x in exchange for working runtime everywhere.

## [1.2.1] - 2026-05-24

### Fixed

- Restore compatibility with IntelliJ IDEA 2024.1 – 2025.2: a single plugin binary now cleanly covers 2024.1 through 2026.2+.

## [1.2.0] - 2026-05-22

### Fixed

- Compatibility with IntelliJ IDEA 2026.2+: implement new JCEF `CefResourceHandler` methods (`open`, `read`, `skip`) — fixes `AbstractMethodError` when opening BPMN files
- Remove `Registry.intValue` call replaced by literal — avoids `Kotlin.Registry.Companion` reference on older IDEs

### Changed

- Bump platform SDK to 2026.2 EAP (262.6228.19)
- Raise minimum supported IDE to 2024.1 (pluginSinceBuild 221 → 241)
- Bump Kotlin 1.9.24 → 2.3.0, JVM toolchain 11 → 17
- Migrate to IntelliJ Platform Gradle Plugin 2.5.0 (legacy `org.jetbrains.intellij` 1.x → `org.jetbrains.intellij.platform` 2.x)
- Bump Gradle wrapper 8.1 → 8.10
- Replace removed `MockVirtualFileSystem` in tests with `LightVirtualFile`

### Removed

- Dead code: unregistered `BPMNParserDefinition` and `BPMNFile` (no `lang.parserDefinition` extension in plugin.xml — never instantiated)

## [1.1.0] - 2026-04-30

### Added

- Rating prompt: after a few BPMN file opens, the plugin offers a one-time link to leave a Marketplace review (dismissible)

### Fixed

- CDATA in BPMN diagrams no longer breaks rendering (#24)
- Async error capture in diagram import
- Theme-aware loading panel background reduces flash on dark theme

### Changed

- Upgrade bpmn-js 13.1.0 → 17.8.1
- Upgrade Kotlin, IntelliJ Platform Plugin, Kover, Qodana, Changelog plugins

## [1.0.0] - 2024-07-09

### Fixed

- IDEA cannot open xml error
- Security update

## [0.1.0] - 2023-06-07

### Added

- BPMN Viewer
- Validation and error handling in panel
- Add .bpmn files to IDEA

## [0.2.0] - 2023-06-12

### Added

- Update issue templates
- Supported dark theme icon
- Change canvas state after XML editing.

### Fixed

- Initializing scheme handler for WebView.

## [0.2.1] - 2023-06-27

### Fixed

- Fixed icons in expUi.

## [0.2.2] - 2023-06-28

### Fixed

- Fixed GitHub build action

## [0.3.0] - 2023-07-06

### Added

- Dark mode

### Fixed

- Blnking Cef browser in dark mode

## [0.3.1] - 2023-07-16

### Fixed

- Fixed infinite loading

## [0.4.0] - 2023-07-19

### Added

- Support for `bpmn20` and `bpmn20.xml` files

## [0.5.0] - 2023-10-16

### Added

- Supported new 232.* version

### Fixed

- PostCSS line return parsing error Moderate
- word-wrap vulnerable to Regular Expression Denial of Service

## [0.6.0] - 2024-01-03

### Fixed

- Security update
- Supported intellij 233.* +

[Unreleased]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v1.2.5...v1.3.0
[1.2.5]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v1.2.4...v1.2.5
[1.2.4]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v0.1.0...v1.0.0
[0.6.0]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v0.1.0...v0.6.0
[0.5.0]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v0.1.0...v0.5.0
[0.4.0]: https://github.com/shlaikov/intellij-bpmn2-plugin/commits/v0.4.0
[0.3.1]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v0.4.0...v0.3.1
[0.3.0]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v0.3.1...v0.3.0
[0.2.2]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v0.3.0...v0.2.2
[0.2.1]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v0.2.2...v0.2.1
[0.2.0]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v0.2.1...v0.2.0
[0.1.0]: https://github.com/shlaikov/intellij-bpmn2-plugin/compare/v0.2.0...v0.1.0
