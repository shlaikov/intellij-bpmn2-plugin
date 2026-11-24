package com.github.shlaikov.intellijbpmn2plugin.diagram

import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.vfs.VirtualFile
import java.util.Locale
import javax.swing.Icon

/**
 * A diagram format the plugin can render. The single source of truth for "is this file ours, and what is it":
 * the editor provider, the icon provider and the webview (which picks its renderer by [id]) all go through it.
 *
 * Files are recognised by name rather than by registered [com.intellij.openapi.fileTypes.FileType], so the viewer
 * keeps working when another plugin owns the extension, and compound suffixes such as `.bpmn20.xml` are matched.
 */
enum class DiagramKind(
    /** Stable identifier shared with the webview (`window.bpmn2Data.kind`). */
    val id: String,
    private val suffixes: List<String>,
    iconPath: String
) {
    BPMN("bpmn", listOf(".bpmn", ".bpmn.xml", ".bpmn2", ".bpmn20", ".bpmn20.xml"), "/icons/bpmn.svg"),
    DMN("dmn", listOf(".dmn", ".dmn.xml"), "/icons/dmn.svg");

    val icon: Icon = IconLoader.getIcon(iconPath, DiagramKind::class.java)

    fun matches(fileName: String): Boolean {
        val name = fileName.lowercase(Locale.ROOT)

        return suffixes.any(name::endsWith)
    }

    companion object {
        fun of(file: VirtualFile?): DiagramKind? {
            if (file == null || file.isDirectory || !file.isValid) {
                return null
            }

            return entries.firstOrNull { it.matches(file.name) }
        }
    }
}
