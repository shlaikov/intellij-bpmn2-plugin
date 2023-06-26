package com.github.shlaikov.intellijbpmn2plugin.editor

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.github.shlaikov.intellijbpmn2plugin.utils.LoadableJCEFHtmlPanel
import com.github.shlaikov.intellijbpmn2plugin.utils.SchemeHandlerFactory
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.fileEditor.impl.LoadTextUtil
import com.intellij.openapi.vfs.VirtualFile
import com.jetbrains.rd.util.lifetime.Lifetime
import com.intellij.ui.jcef.JBCefJSQuery
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import org.jetbrains.concurrency.AsyncPromise
import org.jetbrains.concurrency.Promise
import java.net.URI


class WebView(lifetime: Lifetime) {
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

    fun initializeSchemeHandler(file: VirtualFile) {
        if (!didRegisterSchemeHandler) {
            didRegisterSchemeHandler = true

            CefApp.getInstance().registerSchemeHandlerFactory(
                "https", "bpmn2-plugin",
                SchemeHandlerFactory { uri: URI ->
                    if (uri.path == "/index.html") {
                        data class InitialData(
                            val baseUrl: String,
                            val lang: String,
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
                                    "en",
                                    LoadTextUtil.loadText(file),
                                    getEditorTheme()
                                )
                            )
                        )

                        updatedText.byteInputStream()
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

    fun openDevTools() {
        panel.browser.openDevtools()
    }

    private fun getEditorTheme(): String {
        if (EditorColorsManager.getInstance().isDarkEditor) {
            return Theme.DARK.toString()
        }

        return Theme.LIGHT.toString()
    }
}
