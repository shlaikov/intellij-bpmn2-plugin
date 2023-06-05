package com.github.shlaikov.intellijbpmn2plugin

import com.intellij.lang.Language
import com.intellij.openapi.fileTypes.LanguageFileType
import com.intellij.openapi.util.IconLoader
import javax.swing.Icon


object BPMN2 : Language("bpmn")

object BPMN2Icon {
    val FILE = IconLoader.getIcon("/icons/file.svg", javaClass)
}

object BPMN2FileType : LanguageFileType(BPMN2) {
    override fun getName() = "bpmn"

    override fun getDescription() = "BPMN 2.0 File"

    override fun getDefaultExtension(): String = "xml"

    override fun getIcon(): Icon {
        return BPMN2Icon.FILE
    }
}
