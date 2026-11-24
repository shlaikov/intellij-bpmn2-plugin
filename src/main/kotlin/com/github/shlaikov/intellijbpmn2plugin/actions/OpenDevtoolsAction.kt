package com.github.shlaikov.intellijbpmn2plugin.actions

import com.github.shlaikov.intellijbpmn2plugin.editor.Editor
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.PlatformDataKeys


class OpenDevtoolsAction : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun actionPerformed(event: AnActionEvent) {
        (event.getData(PlatformDataKeys.FILE_EDITOR) as? Editor)?.openDevTools()
    }

    override fun update(event: AnActionEvent) {
        event.presentation.isVisible = event.getData(PlatformDataKeys.FILE_EDITOR) is Editor
    }
}
