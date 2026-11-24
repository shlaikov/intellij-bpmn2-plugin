package com.github.shlaikov.intellijbpmn2plugin.editor

import com.intellij.openapi.editor.colors.EditorColorsManager

/** [id] is what the webview receives; kept explicit so it never depends on the JVM default locale. */
enum class Theme(val id: String, val background: String) {
    LIGHT("light", "white"),
    DARK("dark", "black");

    companion object {
        fun current(): Theme = if (EditorColorsManager.getInstance().isDarkEditor) DARK else LIGHT
    }
}
