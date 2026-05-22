package com.github.shlaikov.intellijbpmn2plugin.utils

import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefCallback
import org.cef.callback.CefResourceReadCallback
import org.cef.callback.CefResourceSkipCallback
import org.cef.callback.CefSchemeHandlerFactory
import org.cef.handler.CefResourceHandler
import org.cef.misc.BoolRef
import org.cef.misc.IntRef
import org.cef.misc.LongRef
import org.cef.misc.StringRef
import org.cef.network.CefRequest
import org.cef.network.CefResponse
import java.io.IOException
import java.io.InputStream
import java.net.URI

class SchemeHandlerFactory(val getStream: (uri: URI) -> InputStream?) : CefSchemeHandlerFactory {
    override fun create(browser: CefBrowser, frame: CefFrame, schemeName: String, request: CefRequest): CefResourceHandler {
        val uri = URI(request.url)
        val myStream: InputStream? = getStream(uri)

        return object : CefResourceHandler {
            override fun open(request: CefRequest, handleRequest: BoolRef, callback: CefCallback): Boolean {
                handleRequest.set(true)
                return true
            }

            @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
            override fun processRequest(req: CefRequest, callback: CefCallback): Boolean {
                callback.Continue()
                return true
            }

            override fun getResponseHeaders(response: CefResponse, responseLength: IntRef, redirectUrl: StringRef?) {
                if (uri.path.endsWith(".html")) {
                    response.mimeType = "text/html"
                } else if (uri.path.endsWith(".js")) {
                    response.mimeType = "application/javascript"
                } else if (uri.path.endsWith(".css")) {
                    response.mimeType = "text/css"
                } else if (uri.path.endsWith(".svg")) {
                    response.mimeType = "image/svg+xml"
                }

                if (myStream === null) {
                    response.status = 404
                } else {
                    response.status = 200
                }
            }

            private fun readChunk(dataOut: ByteArray, bytesToRead: Int, bytesRead: IntRef): Boolean {
                if (myStream === null) {
                    bytesRead.set(0)
                    return false
                }

                try {
                    val availableSize = myStream.available()
                    return if (availableSize > 0) {
                        bytesRead.set(myStream.read(dataOut, 0, bytesToRead.coerceAtMost(availableSize)))
                        true
                    } else {
                        bytesRead.set(0)
                        try {
                            myStream.close()
                        } catch (_: IOException) {}

                        false
                    }
                } catch (ex: IOException) {
                    return false
                }
            }

            override fun read(dataOut: ByteArray, bytesToRead: Int, bytesRead: IntRef, callback: CefResourceReadCallback): Boolean {
                return readChunk(dataOut, bytesToRead, bytesRead)
            }

            @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
            override fun readResponse(dataOut: ByteArray, bytesToRead: Int, bytesRead: IntRef, callback: CefCallback): Boolean {
                return readChunk(dataOut, bytesToRead, bytesRead)
            }

            override fun skip(bytesToSkip: Long, bytesSkipped: LongRef, callback: CefResourceSkipCallback): Boolean {
                bytesSkipped.set(-2L)
                callback.Continue(-2L)
                return false
            }

            override fun cancel() {}
        }
    }
}
