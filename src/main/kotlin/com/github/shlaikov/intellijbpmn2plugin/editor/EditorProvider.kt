package com.github.shlaikov.intellijbpmn2plugin.editor

import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorPolicy
import com.intellij.openapi.fileEditor.FileEditorProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile


class EditorProvider : FileEditorProvider, DumbAware  {
    /**
     * accept is called whenever IntelliJ opens an editor
     * if accept return true, IntelliJ will open an instance of this editor
     */
    override fun accept(project: Project, file: VirtualFile): Boolean {
        val name = file.name.lowercase()
        val extensions = arrayOf(".bpmn", ".bpmn.xml")

        return extensions.any { ext -> name.endsWith(ext) }
    }

    override fun createEditor(project: Project, file: VirtualFile): FileEditor = Editor(project, file)

    override fun getEditorTypeId() = "BPMN2 JCEF editor"

    override fun getPolicy() = FileEditorPolicy.PLACE_BEFORE_DEFAULT_EDITOR
}