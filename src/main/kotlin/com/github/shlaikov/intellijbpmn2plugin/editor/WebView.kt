package com.github.shlaikov.intellijbpmn2plugin.editor

import com.github.shlaikov.intellijbpmn2plugin.utils.LoadableJCEFHtmlPanel


class WebView() {
    private val panel = LoadableJCEFHtmlPanel("https://bpmn2-plugin/index.html")

    val component = panel.component
}
