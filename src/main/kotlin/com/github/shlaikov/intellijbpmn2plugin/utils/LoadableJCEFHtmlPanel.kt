package com.github.shlaikov.intellijbpmn2plugin.utils

import com.intellij.CommonBundle
import com.intellij.ide.plugins.MultiPanel
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.editor.EditorBundle
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.registry.Registry
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBLoadingPanel
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JCEFHtmlPanel
import com.intellij.util.Alarm
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import org.cef.network.CefRequest
import java.awt.BorderLayout
import java.awt.Color
import javax.swing.JComponent


class LoadableJCEFHtmlPanel(
    url: String? = null, html: String? = null,
    var timeoutCallback: String? = EditorBundle.message("message.html.editor.timeout")
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
    }

    private val themeBackground: JBColor = JBColor(Color.WHITE, Color.BLACK)

    private val multiPanel: MultiPanel = object : MultiPanel() {
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

        htmlPanel.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadStart(browser: CefBrowser?, frame: CefFrame?, transitionType: CefRequest.TransitionType?) {
                alarm.addRequest({ htmlPanel.setHtml(timeoutCallback!!) }, Registry.intValue("html.editor.timeout", 20000))
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
