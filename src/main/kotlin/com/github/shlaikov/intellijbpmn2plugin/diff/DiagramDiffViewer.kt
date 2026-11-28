package com.github.shlaikov.intellijbpmn2plugin.diff

import com.github.shlaikov.intellijbpmn2plugin.BPMN2Bundle
import com.github.shlaikov.intellijbpmn2plugin.diagram.DiagramKind
import com.github.shlaikov.intellijbpmn2plugin.editor.InitialData
import com.github.shlaikov.intellijbpmn2plugin.editor.WebView
import com.intellij.diff.FrameDiffTool
import com.intellij.diff.contents.DocumentContent
import com.intellij.diff.requests.ContentDiffRequest
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.editor.colors.EditorColorsListener
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.util.Disposer
import com.intellij.util.Alarm
import javax.swing.JComponent

/**
 * One comparison on screen. The diff window creates a viewer per request (and per switch between viewers) and
 * disposes it itself, so everything here hangs off the viewer; the request's contents belong to the request.
 */
internal class DiagramDiffViewer(request: ContentDiffRequest, kind: DiagramKind) : FrameDiffTool.DiffViewer {
    private val documents = request.contents.map { (it as? DocumentContent)?.document }

    private val view = WebView(request.title ?: kind.id) { theme ->
        InitialData.diff(kind, theme, side(0, request), side(1, request))
    }

    private val refresh = Alarm(Alarm.ThreadToUse.SWING_THREAD, this)

    init {
        Disposer.register(this, view)

        // The side that is a local file can be edited while the comparison is open.
        documents.filterNotNull().distinct().forEach { document ->
            document.addDocumentListener(object : DocumentListener {
                override fun documentChanged(event: DocumentEvent) = scheduleRefresh()
            }, this)
        }

        ApplicationManager.getApplication().messageBus.connect(this)
            .subscribe(EditorColorsManager.TOPIC, EditorColorsListener { scheduleRefresh() })
    }

    private fun side(index: Int, request: ContentDiffRequest) =
        InitialData.Side(request.contentTitles.getOrNull(index), documents[index]?.immutableCharSequence)

    private fun scheduleRefresh() {
        refresh.cancelAllRequests()
        refresh.addRequest({ view.reload() }, REFRESH_DELAY_MS)
    }

    override fun getComponent(): JComponent = view.component

    override fun getPreferredFocusedComponent(): JComponent = view.component

    // Only fields that exist since 2025.1 are set.
    override fun init(): FrameDiffTool.ToolbarComponents = FrameDiffTool.ToolbarComponents().apply {
        popupActions = listOf(object : DumbAwareAction(BPMN2Bundle.message("diff.action.devtools")) {
            override fun actionPerformed(event: AnActionEvent) = view.openDevTools()
        })
    }

    override fun dispose() = Unit

    private companion object {
        const val REFRESH_DELAY_MS = 300
    }
}
