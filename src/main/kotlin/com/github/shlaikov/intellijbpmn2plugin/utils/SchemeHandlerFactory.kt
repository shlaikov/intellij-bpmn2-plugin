package com.github.shlaikov.intellijbpmn2plugin.utils

import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefCallback
import org.cef.callback.CefSchemeHandlerFactory
import org.cef.handler.CefResourceHandler
import org.cef.misc.IntRef
import org.cef.network.CefRequest
import org.cef.network.CefResponse
import java.io.IOException
import java.io.InputStream
import java.lang.reflect.Proxy
import java.net.URI

// JCEF's `CefResourceHandler` interface was extended in IntelliJ 2026.2 with three new abstract
// methods (`open`, `read`, `skip`) that reference classes which do not exist in older IDEs
// (`BoolRef`, `LongRef`, `CefResourceReadCallback`, `CefResourceSkipCallback`). Directly
// implementing the interface forces the plugin's bytecode to reference one set of classes or
// the other, breaking the Plugin Verifier on whichever IDE range is missing them.
//
// Using a `java.lang.reflect.Proxy` lets us implement the interface dynamically: only
// `CefResourceHandler` (present in every supported IDE) appears in the plugin's class file.
// Method dispatch is by name, so the same handler covers both the legacy 4-method API and the
// new 7-method API without any static reference to the version-specific callback/ref types.
class SchemeHandlerFactory(val getStream: (uri: URI) -> InputStream?) : CefSchemeHandlerFactory {

    override fun create(browser: CefBrowser, frame: CefFrame, schemeName: String, request: CefRequest): CefResourceHandler {
        val uri = URI(request.url)
        val myStream: InputStream? = getStream(uri)

        val proxy = Proxy.newProxyInstance(
            CefResourceHandler::class.java.classLoader,
            arrayOf(CefResourceHandler::class.java)
        ) { proxy, method, args ->
            try {
                when (method.name) {
                    // 2026.2+ JCEF API
                    "open" -> {
                        setPrimitive(args[1], java.lang.Boolean.TYPE, true)
                        true
                    }
                    "read" -> readChunk(args[0] as ByteArray, args[1] as Int, args[2] as IntRef, myStream)
                    "skip" -> {
                        setPrimitive(args[1], java.lang.Long.TYPE, -2L)
                        false
                    }

                    // Legacy JCEF API (2024.1 – 2026.1)
                    "processRequest" -> {
                        (args[1] as CefCallback).Continue()
                        true
                    }
                    "readResponse" -> readChunk(args[0] as ByteArray, args[1] as Int, args[2] as IntRef, myStream)

                    // Common to both APIs
                    "getResponseHeaders" -> {
                        applyHeaders(args[0] as CefResponse, uri, myStream)
                        null
                    }
                    "cancel" -> null

                    // java.lang.Object methods (Proxy forwards these too)
                    "toString" -> "BPMNSchemeHandler[$uri]"
                    "hashCode" -> System.identityHashCode(proxy)
                    "equals" -> proxy === args[0]

                    else -> defaultReturn(method.returnType)
                }
            } catch (_: Throwable) {
                defaultReturn(method.returnType)
            }
        }

        return proxy as CefResourceHandler
    }

    private fun setPrimitive(ref: Any, primitiveType: Class<*>, value: Any) {
        ref.javaClass.getMethod("set", primitiveType).invoke(ref, value)
    }

    private fun applyHeaders(response: CefResponse, uri: URI, stream: InputStream?) {
        when {
            uri.path.endsWith(".html") -> response.mimeType = "text/html"
            uri.path.endsWith(".js") -> response.mimeType = "application/javascript"
            uri.path.endsWith(".css") -> response.mimeType = "text/css"
            uri.path.endsWith(".svg") -> response.mimeType = "image/svg+xml"
        }
        response.status = if (stream === null) 404 else 200
    }

    private fun readChunk(dataOut: ByteArray, bytesToRead: Int, bytesRead: IntRef, stream: InputStream?): Boolean {
        if (stream === null) {
            bytesRead.set(0)
            return false
        }
        try {
            val availableSize = stream.available()
            return if (availableSize > 0) {
                bytesRead.set(stream.read(dataOut, 0, bytesToRead.coerceAtMost(availableSize)))
                true
            } else {
                bytesRead.set(0)
                try { stream.close() } catch (_: IOException) {}
                false
            }
        } catch (_: IOException) {
            return false
        }
    }

    private fun defaultReturn(returnType: Class<*>): Any? = when (returnType) {
        java.lang.Boolean.TYPE -> false
        java.lang.Integer.TYPE -> 0
        java.lang.Long.TYPE -> 0L
        Void.TYPE -> null
        else -> null
    }
}
