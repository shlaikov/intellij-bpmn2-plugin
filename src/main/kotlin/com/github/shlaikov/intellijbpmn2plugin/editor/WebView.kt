package com.github.shlaikov.intellijbpmn2plugin.editor

import com.github.shlaikov.intellijbpmn2plugin.utils.LoadableJCEFHtmlPanel
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.diagnostic.debug
import com.intellij.openapi.diagnostic.logger
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefJSQuery
import org.cef.CefSettings
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefDisplayHandlerAdapter
import org.cef.handler.CefLifeSpanHandlerAdapter
import org.cef.handler.CefLoadHandler
import org.cef.handler.CefLoadHandlerAdapter
import javax.swing.JComponent

/**
 * One page of the webview in a JCEF browser. [name] only identifies the page in the log.
 * [data] supplies `window.bpmn2Data` (see [InitialData]) for every (re)load; it is called on a CEF thread.
 * Everything it creates is disposed together with it.
 */
class WebView(
    private val name: String,
    private val data: (Theme) -> String
) : Disposable {
    private val panel = LoadableJCEFHtmlPanel(DiagramResources.open(this, ::renderIndex))

    private val jsQuery = JBCefJSQuery.create(panel.browser)

    /** JS statement that delivers the variable `message` (a JSON string) to [IncomingMessage.parse]. */
    private val sendToHost = jsQuery.inject("message")

    val component: JComponent get() = panel.component

    init {
        // Children are disposed in reverse registration order: handlers and the JS query go before the browser.
        Disposer.register(this, panel)

        val browser = panel.browser
        val client = browser.jbCefClient

        Disposer.register(this, jsQuery)
        jsQuery.addHandler { request: String ->
            when (IncomingMessage.parse(request)) {
                IncomingMessage.Event.Initialized -> {
                    LOG.debug { "$name: webview is ready" }
                    invokeLater { panel.stopLoading() }
                }
                null -> Unit
            }

            null
        }

        val lifeSpanHandler = object : CefLifeSpanHandlerAdapter() {
            override fun onAfterCreated(browser: CefBrowser?) = DiagramResources.install()

            /**
             * Links in the page (the bpmn.io logo, links in a diagram's documentation) go to the system browser.
             * A JCEF popup would share this browser's client, so its load events would be taken for the
             * diagram's own and bring the loading indicator back for good.
             */
            override fun onBeforePopup(
                browser: CefBrowser?, frame: CefFrame?, targetUrl: String?, targetFrameName: String?
            ): Boolean {
                if (targetUrl != null && (targetUrl.startsWith("https://") || targetUrl.startsWith("http://"))) {
                    invokeLater { BrowserUtil.browse(targetUrl) }
                }

                return true
            }
        }
        val loadHandler = object : CefLoadHandlerAdapter() {
            override fun onLoadError(
                browser: CefBrowser?, frame: CefFrame?, errorCode: CefLoadHandler.ErrorCode?,
                errorText: String?, failedUrl: String?
            ) {
                // ERR_ABORTED is routine: the browser's initial navigation is superseded by the explicit load.
                if (errorCode != CefLoadHandler.ErrorCode.ERR_ABORTED) {
                    LOG.warn("$name: failed to load $failedUrl: $errorCode $errorText")
                }
            }
        }

        // The page's console ends up in idea.log when debug logging is on for the plugin (see CLAUDE.md).
        val displayHandler = object : CefDisplayHandlerAdapter() {
            override fun onConsoleMessage(
                browser: CefBrowser?, level: CefSettings.LogSeverity?, message: String?, source: String?, line: Int
            ): Boolean {
                LOG.debug { "$name: console [$level] $message ($source:$line)" }

                return false
            }
        }

        client.addLifeSpanHandler(lifeSpanHandler, browser.cefBrowser)
        client.addLoadHandler(loadHandler, browser.cefBrowser)
        client.addDisplayHandler(displayHandler, browser.cefBrowser)
        Disposer.register(this) {
            client.removeDisplayHandler(displayHandler, browser.cefBrowser)
            client.removeLoadHandler(loadHandler, browser.cefBrowser)
            client.removeLifeSpanHandler(lifeSpanHandler, browser.cefBrowser)
        }
    }

    /**
     * Called for every (re)load of the page, so it always reflects the data and the IDE theme as they are now.
     *
     * The webview -> host function is part of the page itself rather than injected once the page has loaded:
     * an injected script races with the page's own code and, on a fast reload, can miss the new document
     * altogether — the page would then never be able to report that it is ready.
     */
    private fun renderIndex(template: String): String {
        val theme = Theme.current()

        // One pass over the template, so nothing inside the substituted file text is treated as a placeholder.
        return PLACEHOLDER.replace(template) { match ->
            when (match.groupValues[1]) {
                "initialData" -> data(theme)
                "initialColor" -> theme.background
                "sendToHost" -> sendToHost
                else -> match.value
            }
        }
    }

    fun reload() {
        panel.browser.cefBrowser.reloadIgnoreCache()
    }

    fun openDevTools() {
        panel.browser.openDevtools()
    }

    override fun dispose() {
        LOG.debug { "$name: disposed" }
    }

    private companion object {
        val LOG = logger<WebView>()
        val PLACEHOLDER = Regex("""\$\$(\w+)\$\$""")
    }
}
