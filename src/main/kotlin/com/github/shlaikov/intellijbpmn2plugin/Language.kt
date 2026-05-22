package com.github.shlaikov.intellijbpmn2plugin

import com.intellij.ide.highlighter.XmlFileType
import com.intellij.ide.highlighter.XmlLikeFileType
import com.intellij.lang.Language
import com.intellij.openapi.util.IconLoader
import javax.swing.Icon


object BPMN2 : Language("bpmn", "application/xml", "text/xml")

object BPMN2Icon {
    @JvmField
    val FileType = IconLoader.getIcon("/icons/bpmn.svg", javaClass)
}

object BPMN2FileType : XmlLikeFileType(BPMN2) {
    override fun getName() = "bpmn"

    override fun getDescription() = "BPMN 2.0 File"

    override fun getDefaultExtension(): String = XmlFileType.DEFAULT_EXTENSION

    override fun getIcon(): Icon = BPMN2Icon.FileType
}
