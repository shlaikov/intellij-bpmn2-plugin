package com.github.shlaikov.intellijbpmn2plugin.icons

import com.github.shlaikov.intellijbpmn2plugin.BPMN2Icon
import com.github.shlaikov.intellijbpmn2plugin.utils.File
import com.intellij.ide.IconProvider
import com.intellij.openapi.project.DumbAware
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import javax.swing.Icon

class IconProvider : DumbAware, IconProvider() {

    override fun getIcon(element: PsiElement, flags: Int): Icon? {
        if (element is PsiFile) {
            if (File.isBPMNFile(element.virtualFile)) {
                return BPMN2Icon.FileType
            }
        }

        return null
    }
}
