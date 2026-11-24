package com.github.shlaikov.intellijbpmn2plugin.editor

import com.github.shlaikov.intellijbpmn2plugin.diagram.DiagramKind
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorPolicy
import com.intellij.openapi.fileEditor.FileEditorProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile


class EditorProvider : FileEditorProvider, DumbAware  {
    override fun accept(project: Project, file: VirtualFile): Boolean = DiagramKind.of(file) != null

    override fun createEditor(project: Project, file: VirtualFile): FileEditor =
        Editor(project, file, checkNotNull(DiagramKind.of(file)) { "Not a diagram file: ${file.name}" })

    // Persisted in workspace files as the selected-editor key, so it keeps its historical BPMN-only name.
    override fun getEditorTypeId() = "BPMN2_JCEF_viewer"

    override fun getPolicy() = FileEditorPolicy.PLACE_BEFORE_DEFAULT_EDITOR
}
