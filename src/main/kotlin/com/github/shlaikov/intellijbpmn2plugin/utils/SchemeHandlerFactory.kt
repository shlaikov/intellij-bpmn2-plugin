package com.github.shlaikov.intellijbpmn2plugin.utils

import com.intellij.openapi.Disposable
import com.intellij.ui.jcef.utils.JBCefStreamResourceHandler
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefSchemeHandlerFactory
import org.cef.handler.CefResourceHandler
import org.cef.network.CefRequest
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.URI

class SchemeHandlerFactory(
    private val parentDisposable: Disposable,
    private val getStream: (uri: URI) -> InputStream?
) : CefSchemeHandlerFactory {
    override fun create(browser: CefBrowser, frame: CefFrame, schemeName: String, request: CefRequest): CefResourceHandler {
        val uri = URI(request.url)
        val stream = getStream(uri) ?: ByteArrayInputStream(ByteArray(0))

        return JBCefStreamResourceHandler(stream, mimeType(uri.path), parentDisposable, emptyMap())
    }

    private fun mimeType(path: String): String = when {
        path.endsWith(".html") -> "text/html"
        path.endsWith(".js") -> "application/javascript"
        path.endsWith(".css") -> "text/css"
        path.endsWith(".svg") -> "image/svg+xml"
        else -> "application/octet-stream"
    }
}
