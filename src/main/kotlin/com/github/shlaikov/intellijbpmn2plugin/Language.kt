package com.github.shlaikov.intellijbpmn2plugin

import com.intellij.lang.Language
import com.intellij.openapi.fileTypes.LanguageFileType
import com.intellij.openapi.util.IconLoader


object BPMN2 : Language("bpmn")

object BPMN2Icon {
    val FILE = IconLoader.getIcon("/icons/diagrams.svg", this.javaClass)
}

object BPMN2FileType : LanguageFileType(BPMN2) {
    override fun getName() = "bpmn"
    override fun getDescription() = "BPMN2 File"
    override fun getDefaultExtension(): String = "text/xml"
    override fun getIcon() = BPMN2Icon.FILE
}
