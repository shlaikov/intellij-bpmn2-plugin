package com.github.shlaikov.intellijbpmn2plugin

import com.github.shlaikov.intellijbpmn2plugin.diagram.DiagramKind
import com.intellij.ide.highlighter.XmlLikeFileType
import com.intellij.lang.Language
import javax.swing.Icon

object BPMN2 : Language("bpmn", "application/xml", "text/xml")

object DMN : Language("dmn", "application/xml", "text/xml")

object BPMN2FileType : XmlLikeFileType(BPMN2) {
    override fun getName() = "bpmn"

    override fun getDescription() = "BPMN 2.0 File"

    override fun getDefaultExtension(): String = "bpmn"

    override fun getIcon(): Icon = DiagramKind.BPMN.icon
}

object DMNFileType : XmlLikeFileType(DMN) {
    override fun getName() = "dmn"

    override fun getDescription() = "DMN File"

    override fun getDefaultExtension(): String = "dmn"

    override fun getIcon(): Icon = DiagramKind.DMN.icon
}
