package com.github.shlaikov.intellijbpmn2plugin.editor

import com.fasterxml.jackson.databind.ObjectMapper
import com.github.shlaikov.intellijbpmn2plugin.utils.LoadableJCEFHtmlPanel
import com.jetbrains.rd.util.lifetime.Lifetime
import com.intellij.ui.jcef.JBCefJSQuery
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import org.jetbrains.concurrency.AsyncPromise
import org.jetbrains.concurrency.Promise


class WebView(lifetime: Lifetime, mapper: ObjectMapper) {
    private val panel = LoadableJCEFHtmlPanel("https://bpmn2-plugin/index.html")

    val component = panel.component

    private var _initializedPromise = AsyncPromise<Unit>()

    fun initialized(): Promise<Unit> {
        return _initializedPromise
    }

    init {
        val jsRequestHandler = JBCefJSQuery.create(panel.browser).also { handler ->
            handler.addHandler { _: String ->
                null
            }

            lifetime.onTerminationIfAlive {
                handler.dispose()
                panel.dispose()
            }
        }

        object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(browser: CefBrowser?, frame: CefFrame?, httpStatusCode: Int) {
                frame?.executeJavaScript(
                    "window.sendMessageToHost = function(message) {" +
                        jsRequestHandler.inject("message") +
                    "};",
                    frame.url, 0
                )
            }
        }.also { handler ->
            panel.browser.jbCefClient.addLoadHandler(handler, panel.browser.cefBrowser)

            lifetime.onTerminationIfAlive {
                panel.browser.jbCefClient.removeLoadHandler(handler, panel.browser.cefBrowser)
            }
        }
    }

    fun reload(ignoreCache: Boolean = false) = if (ignoreCache) {
        panel.browser.cefBrowser.reloadIgnoreCache()
    } else {
        panel.browser.cefBrowser.reload()
    }

    fun openDevTools() {
        panel.browser.openDevtools()
    }
}
