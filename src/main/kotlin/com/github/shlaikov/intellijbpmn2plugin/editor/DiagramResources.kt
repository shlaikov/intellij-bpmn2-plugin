package com.github.shlaikov.intellijbpmn2plugin.editor

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.debug
import com.intellij.openapi.diagnostic.logger
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.utils.JBCefStreamResourceHandler
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefSchemeHandlerFactory
import org.cef.handler.CefResourceHandler
import org.cef.network.CefRequest
import java.io.InputStream
import java.net.URI
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * Serves the built webview (`/webview/dist`) to every diagram editor from `https://bpmn2-plugin/editor/<id>/…`.
 *
 * CEF scheme handler factories are registered per (scheme, domain) for the whole application, not per browser,
 * so a factory that closes over one editor ends up answering for all of them. Hence one shared factory and an
 * editor id in the path: `index.html` is rendered by the editor that owns the id, everything else is a static
 * asset (the webview is built with relative URLs, so assets resolve under the same prefix).
 */
internal object DiagramResources : CefSchemeHandlerFactory {
    private const val SCHEME = "https"
    private const val DOMAIN = "bpmn2-plugin"
    private const val DIST = "/webview/dist"
    private const val INDEX = "index.html"

    private val REQUEST_PATH = Regex("^/editor/([^/]+)/(.+)$")
    private val LOG = logger<DiagramResources>()

    private class Session(val owner: Disposable, val renderIndex: (template: String) -> String)

    private val sessions = ConcurrentHashMap<String, Session>()
    private val nextId = AtomicLong()

    /**
     * Opens a session that lives until [owner] is disposed and returns the URL of its page.
     * [renderIndex] receives the `index.html` template on every (re)load and returns the page for that editor.
     */
    fun open(owner: Disposable, renderIndex: (template: String) -> String): String {
        val id = nextId.incrementAndGet().toString()

        sessions[id] = Session(owner, renderIndex)
        Disposer.register(owner) { sessions.remove(id) }

        return "$SCHEME://$DOMAIN/editor/$id/$INDEX"
    }

    /**
     * Must be called once CEF is up (a browser's `onAfterCreated`). Registering the same factory again is a
     * no-op replacement, so every editor calls it: that also restores the handler if CEF has been restarted.
     */
    fun install() {
        val registered = CefApp.getInstance().registerSchemeHandlerFactory(SCHEME, DOMAIN, this)

        LOG.debug { "scheme handler for $SCHEME://$DOMAIN registered: $registered" }
    }

    override fun create(
        browser: CefBrowser?, frame: CefFrame?, schemeName: String?, request: CefRequest
    ): CefResourceHandler? {
        val path = runCatching { URI(request.url).path }.getOrNull() ?: return null
        val (id, resource) = REQUEST_PATH.matchEntire(path)?.destructured ?: return null
        val session = sessions[id] ?: return null
        val stream = if (resource == INDEX) index(session) else asset(resource)

        LOG.debug { "editor $id: ${if (stream != null) "serving" else "missing"} $resource" }

        return JBCefStreamResourceHandler(
            stream ?: InputStream.nullInputStream(), mimeType(resource), session.owner, emptyMap()
        )
    }

    private fun index(session: Session): InputStream? =
        asset(INDEX)?.use { session.renderIndex(it.reader().readText()).byteInputStream() }

    private fun asset(resource: String): InputStream? {
        if (resource.split('/').any { it == ".." }) {
            return null
        }

        return DiagramResources::class.java.getResourceAsStream("$DIST/$resource")
    }

    private fun mimeType(resource: String): String = when (resource.substringAfterLast('.', "")) {
        "html" -> "text/html"
        "js" -> "application/javascript"
        "css" -> "text/css"
        "json", "map" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "woff" -> "font/woff"
        "woff2" -> "font/woff2"
        "ttf" -> "font/ttf"
        "eot" -> "application/vnd.ms-fontobject"
        else -> "application/octet-stream"
    }
}
