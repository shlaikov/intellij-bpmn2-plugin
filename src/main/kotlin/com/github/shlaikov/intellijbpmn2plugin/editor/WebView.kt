package com.github.shlaikov.intellijbpmn2plugin.editor

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.github.shlaikov.intellijbpmn2plugin.utils.LoadableJCEFHtmlPanel
import com.github.shlaikov.intellijbpmn2plugin.utils.SchemeHandlerFactory
import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.fileEditor.impl.LoadTextUtil
import com.intellij.openapi.vfs.VirtualFile
import com.jetbrains.rd.util.lifetime.Lifetime
import com.intellij.ui.jcef.JBCefJSQuery
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLifeSpanHandlerAdapter
import org.cef.handler.CefLoadHandlerAdapter
import org.jetbrains.concurrency.AsyncPromise
import org.jetbrains.concurrency.Promise
import java.net.URI


class WebView(lifetime: Lifetime, file: VirtualFile) {
    private val panel = LoadableJCEFHtmlPanel("https://bpmn2-plugin/index.html")

    val component = panel.component

    private var _initializedPromise = AsyncPromise<Unit>()
    private var didRegisterSchemeHandler = false
    private val mapper = jacksonObjectMapper().apply {
        configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
    }

    fun initialized(): Promise<Unit> {
        return _initializedPromise
    }

    private fun handleEvent(event: IncomingMessage.Event) = when (event) {
        is IncomingMessage.Event.Initialized -> {
            _initializedPromise.setResult(Unit)
        }
    }

    init {
        val jsRequestHandler = JBCefJSQuery.create(panel.browser).also { handler ->
            handler.addHandler { request: String ->
                val message = mapper.readValue(request, IncomingMessage::class.java)

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

        object : CefLifeSpanHandlerAdapter() {
            override fun onAfterCreated(browser: CefBrowser?) {
                super.onAfterCreated(browser)

                initializeSchemeHandler(file)
            }
        }.also { handler ->
            panel.browser.jbCefClient.addLifeSpanHandler(handler, panel.browser.cefBrowser)

            lifetime.onTerminationIfAlive {
                panel.browser.jbCefClient.removeLifeSpanHandler(handler, panel.browser.cefBrowser)
            }
        }

        object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(browser: CefBrowser?, frame: CefFrame?, httpStatusCode: Int) {
                frame?.executeJavaScript(
                "window.sendMessageToHost = function(message) {" +
                    jsRequestHandler.inject("message") +
                "};", frame.url, 0
                )
            }
        }.also { handler ->
            panel.browser.jbCefClient.addLoadHandler(handler, panel.browser.cefBrowser)

            lifetime.onTerminationIfAlive {
                panel.browser.jbCefClient.removeLoadHandler(handler, panel.browser.cefBrowser)
            }
        }
    }

    fun initializeSchemeHandler(file: VirtualFile) {
        if (!didRegisterSchemeHandler) {
            val theme = getEditorTheme()

            didRegisterSchemeHandler = true

            CefApp.getInstance().registerSchemeHandlerFactory(
                "https", "bpmn2-plugin",
                SchemeHandlerFactory { uri: URI ->
                    if (uri.path == "/index.html") {
                        data class InitialData(
                            val baseUrl: String,
                            val file: CharSequence,
                            val theme: String
                        )

                        val text = WebView::class.java.getResourceAsStream("/webview/dist/index.html")!!.reader()
                            .readText()
                        val updatedText = text.replace(
                            "\$\$initialData\$\$",
                            mapper.writeValueAsString(
                                InitialData(
                                    "https://bpmn2-plugin",
                                    LoadTextUtil.loadText(file),
                                    theme.toString()
                                )
                            )
                        )
                        val result = updatedText.replace(
                            "\$\$initialColor\$\$",
                            if (theme == Theme.DARK) "black" else "white"
                        )
                        result.byteInputStream()
                    } else {
                        WebView::class.java.getResourceAsStream("/webview/dist" + uri.path)
                    }
                }
            ).also { successful -> assert(successful) }
        }
    }

    fun reload(ignoreCache: Boolean = false) = if (ignoreCache) {
        panel.browser.cefBrowser.reloadIgnoreCache()
    } else {
        panel.browser.cefBrowser.reload()
    }

    fun stopLoading() {
        panel.stopLoading()
    }

    fun openDevTools() {
        panel.browser.openDevtools()
    }

    private fun getEditorTheme(): Theme {
        if (EditorColorsManager.getInstance().isDarkEditor) {
            return Theme.DARK
        }

        return Theme.LIGHT
    }
}
