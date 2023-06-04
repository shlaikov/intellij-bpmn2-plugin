package com.github.shlaikov.intellijbpmn2plugin.actions

import com.github.shlaikov.intellijbpmn2plugin.editor.Editor
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.PlatformDataKeys


class OpenDevtoolsAction : AnAction() {
    override fun actionPerformed(event: AnActionEvent) {
        val fileEditor = event.getData(PlatformDataKeys.FILE_EDITOR)

        if (fileEditor != null && fileEditor is Editor) with(fileEditor) {
            openDevTools()
        }
    }

    override fun update(event: AnActionEvent) {
        var visible = false
        val fileEditor = event.getData(PlatformDataKeys.FILE_EDITOR)

        if (fileEditor != null && fileEditor is Editor) {
            visible = true
        }

        event.presentation.isVisible = visible
    }
}