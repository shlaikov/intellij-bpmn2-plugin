package com.github.shlaikov.intellijbpmn2plugin.utils

import com.intellij.CommonBundle
import com.intellij.ide.plugins.MultiPanel
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.diagnostic.debug
import com.intellij.openapi.diagnostic.logger
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.util.Disposer
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBLoadingPanel
import com.intellij.ui.components.Magnificator
import com.intellij.ui.components.ZoomableViewport
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JCEFHtmlPanel
import com.intellij.util.Alarm
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import org.cef.network.CefRequest
import java.awt.BorderLayout
import java.awt.Color
import java.awt.Point
import java.awt.event.MouseWheelEvent
import java.util.Locale
import javax.swing.JComponent


class LoadableJCEFHtmlPanel(
    url: String? = null, html: String? = null,
    var timeoutCallback: String? = "The diagram is taking longer than expected to load."
) : Disposable {
    private val isDarkEditor: Boolean = EditorColorsManager.getInstance().isDarkEditor
    private val alarm = Alarm(Alarm.ThreadToUse.SWING_THREAD, this)

    private val loadingPanel = JBLoadingPanel(BorderLayout(), this)
    private val htmlPanel = JCEFHtmlPanel(false, null, url).apply {
        setPageBackgroundColor(if (isDarkEditor) "#000000" else "#FFFFFF")
        component.background = if (isDarkEditor) Color.BLACK else Color.WHITE
        component.isOpaque = true
    }

    val browser: JBCefBrowserBase get() = htmlPanel
    val component: JComponent get() = this.multiPanel

    companion object {
        private const val LOADING_KEY = 1
        private const val CONTENT_KEY = 0

        /**
         * CSS pixels per AWT wheel unit. On macOS JBR a trackpad reports `preciseWheelRotation` in steps of
         * 0.1 per point with `scrollAmount` 1, so 10 px/unit makes the diagram follow the fingers 1:1;
         * a mouse notch (rotation 1, amount 3) becomes 30 px.
         */
        private const val WHEEL_UNIT_PX = 10.0

        private val LOG = logger<LoadableJCEFHtmlPanel>()
    }

    private val themeBackground: JBColor = JBColor(Color.WHITE, Color.BLACK)

    /**
     * [ZoomableViewport] lets the IDE's own macOS trackpad gesture support (MacGestureAdapter) deliver
     * pinch-to-zoom to us; JCEF never sees the gesture (AWT doesn't map it to wheel events, and in OSR mode
     * Chromium gets no native input at all). Forwarded to `window.bpmn2Pinch` in the webview.
     */
    private val multiPanel: MultiPanel = object : MultiPanel(), ZoomableViewport {
        private val magnificator = Magnificator { _, at -> at }

        override fun create(key: Int) = when (key) {
            LOADING_KEY -> {
                loadingPanel.apply {
                    background = themeBackground
                    setLoadingText(CommonBundle.getLoadingTreeNodeText())
                }
            }
            CONTENT_KEY -> htmlPanel.component
            else -> {
                throw UnsupportedOperationException("Unknown key")
            }
        }

        override fun getMagnificator(): Magnificator = magnificator

        override fun magnificationStarted(at: Point) = sendPinch("start", 0.0, at.x, at.y)

        override fun magnify(magnification: Double) = sendPinch("move", magnification, 0, 0)

        override fun magnificationFinished(magnification: Double) = sendPinch("end", magnification, 0, 0)
    }

    private fun sendPinch(phase: String, magnification: Double, x: Int, y: Int) {
        LOG.debug { "pinch: $phase magnification=$magnification at=$x,$y" }
        val js = String.format(
            Locale.ROOT, "window.bpmn2Pinch && window.bpmn2Pinch('%s', %.4f, %d, %d)", phase, magnification, x, y
        )
        htmlPanel.cefBrowser.executeJavaScript(js, htmlPanel.cefBrowser.url, 0)
    }

    init {
        if (url != null) {
            htmlPanel.loadURL(url)
        }

        if (html != null) {
            htmlPanel.loadHTML(html)
        }

        ApplicationManager.getApplication().invokeLater {
            Disposer.register(this@LoadableJCEFHtmlPanel, alarm)

            multiPanel.select(CONTENT_KEY, true)
        }

        LOG.debug { "JCEF panel: osr=${htmlPanel.isOffScreenRendering} ui=${htmlPanel.cefBrowser.uiComponent.javaClass.name}" }
        if (htmlPanel.isOffScreenRendering) {
            installWheelForwarding()
        }

        htmlPanel.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadStart(browser: CefBrowser?, frame: CefFrame?, transitionType: CefRequest.TransitionType?) {
                alarm.addRequest({ htmlPanel.setHtml(timeoutCallback!!) }, 20000)
            }

            override fun onLoadEnd(browser: CefBrowser?, frame: CefFrame?, httpStatusCode: Int) {
                alarm.cancelAllRequests()
            }

            override fun onLoadingStateChange(browser: CefBrowser?, isLoading: Boolean, canGoBack: Boolean, canGoForward: Boolean) {
                if (isLoading) {
                    invokeLater {
                        startLoading()
                    }
                }
            }
        }, htmlPanel.cefBrowser)
    }

    /**
     * In off-screen rendering mode (forced whenever JCEF runs out-of-process: 2026.2+, and 2025.x by default)
     * the platform forwards AWT wheel events to CEF itself, and badly: the rotation is multiplied by 40 and
     * rounded to an int, horizontal trackpad scrolling (reported by macOS as Shift+wheel) arrives in the page
     * as `deltaX` + `shiftKey`, which diagram-js ignores, and JBR touch-scroll events are dropped by the
     * remote browser altogether. So forward precise deltas straight to the viewer (`window.bpmn2Wheel`,
     * see webview `Viewer`) and consume the AWT event so the platform path is skipped.
     */
    private fun installWheelForwarding() {
        htmlPanel.cefBrowser.uiComponent.addMouseWheelListener { e: MouseWheelEvent ->
            if (LOG.isDebugEnabled) {
                LOG.debug(
                    "wheel: type=${e.scrollType} rotation=${e.wheelRotation} precise=${e.preciseWheelRotation} " +
                    "amount=${e.scrollAmount} units=${e.unitsToScroll} mods=${e.modifiersEx} shift=${e.isShiftDown} " +
                    "ctrl=${e.isControlDown} meta=${e.isMetaDown} at=${e.x},${e.y}"
                )
            }
            val amount = if (e.scrollType == MouseWheelEvent.WHEEL_BLOCK_SCROLL) 3 else maxOf(e.scrollAmount, 1)
            val px = e.preciseWheelRotation * amount * WHEEL_UNIT_PX
            val horizontal = e.isShiftDown && !e.isControlDown && !e.isMetaDown
            val js = String.format(
                Locale.ROOT,
                "window.bpmn2Wheel && window.bpmn2Wheel(%.3f, %.3f, %d, %d, %b, %b)",
                if (horizontal) px else 0.0,
                if (horizontal) 0.0 else px,
                e.x, e.y, e.isControlDown, e.isMetaDown
            )
            htmlPanel.cefBrowser.executeJavaScript(js, htmlPanel.cefBrowser.url, 0)
            e.consume()
        }
    }

    fun startLoading() {
        loadingPanel.startLoading()
        multiPanel.select(LOADING_KEY, true)
    }

    fun stopLoading() {
        multiPanel.select(CONTENT_KEY, true)
        loadingPanel.stopLoading()
    }

    override fun dispose() {
        alarm.dispose()
    }
}
