package com.github.shlaikov.intellijbpmn2plugin.editor

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.github.shlaikov.intellijbpmn2plugin.utils.SchemeHandlerFactory
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorLocation
import com.intellij.openapi.fileEditor.FileEditorState
import com.intellij.openapi.fileEditor.impl.LoadTextUtil
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Key
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.util.UserDataHolderBase
import com.jetbrains.rd.util.lifetime.LifetimeDefinition
import org.cef.CefApp
import java.beans.PropertyChangeListener
import javax.swing.JComponent
import java.net.URI


class Editor(private val project: Project, private val file: VirtualFile) : FileEditor, DumbAware {
    private val lifetimeDef = LifetimeDefinition()
    private val lifetime = lifetimeDef.lifetime
    private val userDataHolder = UserDataHolderBase()

    override fun getFile() = file

    private val mapper = jacksonObjectMapper().apply {
        configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
    }

    private var view :WebView = WebView(lifetime, mapper)
    private var didRegisterSchemeHandler = false

    init {
        initView()
    }

    private fun initView() {
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
                            val showChrome: String
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
                                    "1"
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

    override fun <T : Any?> getUserData(key: Key<T>): T? {
        return userDataHolder.getUserData(key)
    }

    override fun <T : Any?> putUserData(key: Key<T>, value: T?) {
        userDataHolder.putUserData(key, value)
    }

    override fun dispose() {
        lifetimeDef.terminate(true)
    }

    override fun getComponent(): JComponent {
        return view.component
    }

    override fun getPreferredFocusedComponent(): JComponent {
        return view.component
    }

    override fun getName(): String {
        return "Diagram"
    }

    override fun setState(state: FileEditorState) {}

    override fun isModified(): Boolean {
        return false
    }

    override fun isValid(): Boolean {
        return true
    }

    fun openDevTools() {
        view.openDevTools()
    }

    override fun addPropertyChangeListener(listener: PropertyChangeListener) {}

    override fun removePropertyChangeListener(listener: PropertyChangeListener) {}

    override fun getCurrentLocation(): FileEditorLocation? {
        return null
    }
}
