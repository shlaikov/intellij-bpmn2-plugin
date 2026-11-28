package com.github.shlaikov.intellijbpmn2plugin.diff

import com.github.shlaikov.intellijbpmn2plugin.BPMN2Bundle
import com.github.shlaikov.intellijbpmn2plugin.BPMN2FileType
import com.github.shlaikov.intellijbpmn2plugin.DMNFileType
import com.github.shlaikov.intellijbpmn2plugin.diagram.DiagramKind
import com.intellij.diff.DiffContext
import com.intellij.diff.FrameDiffTool
import com.intellij.diff.contents.DiffContent
import com.intellij.diff.contents.DocumentContent
import com.intellij.diff.contents.EmptyContent
import com.intellij.diff.contents.FileContent
import com.intellij.diff.requests.ContentDiffRequest
import com.intellij.diff.requests.DiffRequest
import com.intellij.diff.util.DiffUserDataKeysEx
import com.intellij.openapi.fileEditor.FileDocumentManager

/**
 * Shows two versions of a diagram side by side in the IDE's own diff window (local changes, history,
 * "Compare With…"), next to the text viewers. Which viewer opens first is the platform's decision, remembered
 * per place; the user switches with the viewer chooser in the diff toolbar.
 *
 * Must not mention JCEF types: see [Jcef].
 */
class DiagramDiffTool : FrameDiffTool {
    override fun getName(): String = BPMN2Bundle.message("diff.tool.name")

    // Called for every update of the viewer chooser, so it looks at names only, never at the text.
    override fun canShow(context: DiffContext, request: DiffRequest): Boolean =
        diagramKind(request) != null && Jcef.supported

    override fun createComponent(context: DiffContext, request: DiffRequest): FrameDiffTool.DiffViewer =
        DiagramDiffViewer(request as ContentDiffRequest, checkNotNull(diagramKind(request)))
}

/**
 * The format both sides of [request] are in, or `null` if this is not a comparison of two diagrams.
 * A side may be missing (a file that was added or deleted) or unnamed (the clipboard).
 */
internal fun diagramKind(request: DiffRequest): DiagramKind? {
    val contents = (request as? ContentDiffRequest)?.contents ?: return null

    if (contents.size != 2 || contents.any { it !is DocumentContent && it !is EmptyContent }) {
        return null
    }

    return contents.mapNotNull(::kindOf).distinct().singleOrNull()
}

private fun kindOf(content: DiffContent): DiagramKind? {
    if (content !is DocumentContent) {
        return null
    }

    // A revision from VCS has no file (and for a deleted or renamed file no highlight file either), only a name.
    val name = content.getUserData(DiffUserDataKeysEx.FILE_NAME)
        ?: (content as? FileContent)?.file?.name
        ?: content.highlightFile?.name
        ?: FileDocumentManager.getInstance().getFile(content.document)?.name

    return DiagramKind.ofName(name) ?: when (content.contentType) {
        BPMN2FileType -> DiagramKind.BPMN
        DMNFileType -> DiagramKind.DMN
        else -> null
    }
}
