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
import java.util.*


class WebView(lifetime: Lifetime, mapper: ObjectMapper) {
    private val panel = LoadableJCEFHtmlPanel("https://bpmn2-plugin/index.html")

    val component = panel.component

    private val responseMap = HashMap<String, AsyncPromise<IncomingMessage.Response>>()
    private var _initializedPromise = AsyncPromise<Unit>()

    fun initialized(): Promise<Unit> {
        return _initializedPromise
    }

    init {
        val jsRequestHandler = JBCefJSQuery.create(panel.browser).also { handler ->
            handler.addHandler { request: String ->
                val message = mapper.readValue(request, IncomingMessage::class.java)

                if (message is IncomingMessage.Response) {
                    val promise = responseMap[message.requestId]!!
                    responseMap.remove(message.requestId)
                    promise.setResult(message)
                }

                if (message is IncomingMessage.Event) {
                    this.handleEvent(message)
                }

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

    fun openDevTools() {
        panel.browser.openDevtools()
    }

    fun handleEvent(event: IncomingMessage.Event) {
        when (event) {
            is IncomingMessage.Event.Initialized -> {
                _initializedPromise.setResult(Unit)
            }
            is IncomingMessage.Event.Configure -> {}
            is IncomingMessage.Event.AutoSave -> {}
            is IncomingMessage.Event.Save -> {}
            IncomingMessage.Event.Load -> {}
        }
    }
}
