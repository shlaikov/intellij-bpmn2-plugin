package com.github.shlaikov.intellijbpmn2plugin.diff

import com.intellij.ui.jcef.JBCefApp

/**
 * The diff tool is instantiated in every IDE, also where the plugin's optional JCEF dependency is not
 * satisfied (2026.2+ with the Web Browser plugin disabled). This is the one place it asks about JCEF, so a
 * missing class turns into "not supported" instead of an error on every diff that is opened.
 */
internal object Jcef {
    val supported: Boolean by lazy {
        try {
            JBCefApp.isSupported()
        } catch (_: LinkageError) {
            false
        }
    }
}
