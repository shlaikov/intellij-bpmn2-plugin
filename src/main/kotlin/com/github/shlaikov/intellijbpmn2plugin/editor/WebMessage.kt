package com.github.shlaikov.intellijbpmn2plugin.editor

import com.github.shlaikov.intellijbpmn2plugin.diagram.DiagramKind

/** What a page starts with: the JSON the webview finds in `window.bpmn2Data` (`host/bridge.ts`). */
object InitialData {
    /** One side of a comparison; [text] is `null` when the file does not exist in that revision. */
    class Side(val title: String?, val text: CharSequence?)

    /** A page showing one document. */
    fun viewer(kind: DiagramKind, theme: Theme, text: CharSequence): String =
        "{${common(kind, theme)},\"file\":${text.toString().toJsonString()}}"

    /** A page comparing two versions of a document. */
    fun diff(kind: DiagramKind, theme: Theme, left: Side, right: Side): String =
        "{${common(kind, theme)},\"diff\":{" +
            "\"left\":${left.text.toJson()},\"leftTitle\":${left.title.toJson()}," +
            "\"right\":${right.text.toJson()},\"rightTitle\":${right.title.toJson()}}}"

    private fun common(kind: DiagramKind, theme: Theme): String =
        "\"kind\":${kind.id.toJsonString()},\"theme\":${theme.id.toJsonString()}"

    private fun CharSequence?.toJson(): String = this?.toString()?.toJsonString() ?: "null"
}

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
            // '<', '>' and '&' are escaped so that file content such as "</script>" or "<!--" cannot end the script block;
            // U+2028 and U+2029 are valid in JSON but were line terminators in JavaScript string literals before ES2019
            '<', '>', '&', '\u2028', '\u2029' -> out.appendUnicodeEscape(ch)
            else -> if (ch < ' ') out.appendUnicodeEscape(ch) else out.append(ch)
        }
    }

    return out.append('"').toString()
}

private fun StringBuilder.appendUnicodeEscape(ch: Char) {
    append("\\u").append(ch.code.toString(16).padStart(4, '0'))
}
