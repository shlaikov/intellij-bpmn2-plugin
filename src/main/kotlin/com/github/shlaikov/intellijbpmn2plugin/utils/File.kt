package com.github.shlaikov.intellijbpmn2plugin.utils

import com.intellij.openapi.vfs.VirtualFile

class File {
    companion object {
        private val SUPPORTED_EXTENSIONS = arrayOf(".bpmn", ".bpmn.xml", ".bpmn2", ".bpmn20", ".bpmn20.xml")

        fun isBPMNFile(file: VirtualFile?): Boolean {
            if (file == null) {
                return false
            }

            if (file.isDirectory || !file.exists()) {
                return false
            }

            val extensions = SUPPORTED_EXTENSIONS

            return extensions.any { ext -> file.name.lowercase().endsWith(ext) }
        }
    }
}
