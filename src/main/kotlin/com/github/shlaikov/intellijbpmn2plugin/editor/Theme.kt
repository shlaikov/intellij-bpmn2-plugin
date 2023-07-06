package com.github.shlaikov.intellijbpmn2plugin.editor

import java.util.*


enum class Theme {
    LIGHT,
    DARK;

    override fun toString(): String {
        return name.lowercase(Locale.getDefault())
    }
}
