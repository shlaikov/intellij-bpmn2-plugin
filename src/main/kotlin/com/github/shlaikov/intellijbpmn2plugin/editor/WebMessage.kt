package com.github.shlaikov.intellijbpmn2plugin.editor

sealed class IncomingMessage {
    sealed class Event : IncomingMessage() {
        object Initialized : Event()
    }

    companion object {
        private val EVENT_NAME = Regex("\"event\"\\s*:\\s*\"([^\"\\\\]*)\"")

        /**
         * Messages from the webview are flat objects tagged with an `event` name, e.g. `{"event":"init"}`.
         * Parsed by hand: the plugin must not depend on a JSON library from the IDE classpath (see [toJsonString]).
         */
        fun parse(json: String): IncomingMessage? = when (EVENT_NAME.find(json)?.groupValues?.get(1)) {
            "init" -> Event.Initialized
            else -> null
        }
    }
}

/**
 * Serializes a string as a JSON literal that is also safe to inline into an HTML `<script>` block.
 *
 * Hand-written on purpose: Jackson (`jackson-module-kotlin`) used to be reachable through the platform
 * classloader, but IntelliJ 2026.3 no longer exposes it to plugins (`NoClassDefFoundError`, #37).
 */
fun String.toJsonString(): String {
    val out = StringBuilder(length + 16).append('"')

    for (ch in this) {
        when (ch) {
            '"' -> out.append("\\\"")
            '\\' -> out.append("\\\\")
            '\n' -> out.append("\\n")
            '\r' -> out.append("\\r")
            '\t' -> out.append("\\t")
            // '<', '>' and '&' are escaped so that file content such as "</script>" or "<!--" cannot end the script block
            '<', '>', '&', ' ', ' ' -> out.appendUnicodeEscape(ch)
            else -> if (ch < ' ') out.appendUnicodeEscape(ch) else out.append(ch)
        }
    }

    return out.append('"').toString()
}

private fun StringBuilder.appendUnicodeEscape(ch: Char) {
    append("\\u").append(ch.code.toString(16).padStart(4, '0'))
}
