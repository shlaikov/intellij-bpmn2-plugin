package com.github.shlaikov.intellijbpmn2plugin.editor

import com.github.shlaikov.intellijbpmn2plugin.diagram.DiagramKind
import com.github.shlaikov.intellijbpmn2plugin.notifications.RatingNotification
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.colors.EditorColorsListener
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorLocation
import com.intellij.openapi.fileEditor.FileEditorState
import com.intellij.openapi.fileEditor.impl.LoadTextUtil
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.UserDataHolderBase
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileContentChangeEvent
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.util.Alarm
import java.beans.PropertyChangeListener
import javax.swing.JComponent


class Editor(project: Project, private val file: VirtualFile, kind: DiagramKind) :
    UserDataHolderBase(), FileEditor, DumbAware {

    /**
     * The text the IDE has for the file, including edits that are not saved yet. Held here so the document stays
     * alive (the platform references documents weakly) and its changes keep arriving.
     */
    private val document: Document? = ReadAction.compute<Document?, RuntimeException> {
        FileDocumentManager.getInstance().getDocument(file)
    }

    private val view = WebView(file, kind) { document?.immutableCharSequence ?: LoadTextUtil.loadText(file) }

    private val refresh = Alarm(Alarm.ThreadToUse.SWING_THREAD, this)

    /** Set when the text changed while the diagram was not on screen; it is then reloaded once it is shown. */
    private var stale = false

    init {
        Disposer.register(this, view)

        // The diagram follows the text as it is typed, not the file on disk: saving happens on the IDE's own
        // schedule, so waiting for it left a stale diagram (or a stale error) on screen for many seconds.
        document?.addDocumentListener(object : DocumentListener {
            override fun documentChanged(event: DocumentEvent) = scheduleRefresh()
        }, this)

        val connection = ApplicationManager.getApplication().messageBus.connect(this)

        // Covers files that have no document; otherwise an external change reaches us through the document too.
        connection.subscribe(VirtualFileManager.VFS_CHANGES, object : BulkFileListener {
            override fun after(events: List<VFileEvent>) {
                if (events.any { it is VFileContentChangeEvent && it.file == file }) {
                    scheduleRefresh()
                }
            }
        })
        connection.subscribe(EditorColorsManager.TOPIC, EditorColorsListener { scheduleRefresh() })

        RatingNotification.trackOpenAndMaybePrompt(project)
    }

    /** Coalesces bursts of changes (typing, a save that follows it) into one reload. */
    private fun scheduleRefresh() {
        refresh.cancelAllRequests()
        refresh.addRequest({
            if (view.component.isShowing) {
                view.reload()
            } else {
                stale = true
            }
        }, REFRESH_DELAY_MS)
    }

    override fun selectNotify() {
        if (stale) {
            stale = false
            view.reload()
        }
    }

    override fun getName(): String = "Diagram"

    override fun getFile() = file

    override fun getComponent(): JComponent = view.component

    override fun getPreferredFocusedComponent(): JComponent = view.component

    override fun setState(state: FileEditorState) = Unit

    override fun isModified(): Boolean = false

    override fun isValid(): Boolean = file.isValid

    fun openDevTools() {
        view.openDevTools()
    }

    override fun addPropertyChangeListener(listener: PropertyChangeListener) = Unit

    override fun removePropertyChangeListener(listener: PropertyChangeListener) = Unit

    override fun getCurrentLocation(): FileEditorLocation? = null

    override fun dispose() = Unit

    private companion object {
        const val REFRESH_DELAY_MS = 300
    }
}
