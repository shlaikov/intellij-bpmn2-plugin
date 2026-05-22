package com.github.shlaikov.intellijbpmn2plugin.notifications

import com.github.shlaikov.intellijbpmn2plugin.BPMN2Bundle
import com.intellij.ide.BrowserUtil
import com.intellij.ide.util.PropertiesComponent
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project

object RatingNotification {
    private const val OPEN_COUNT_KEY = "bpmn2plugin.rating.openCount"
    private const val DISMISSED_KEY = "bpmn2plugin.rating.dismissed"
    private const val SHOWN_KEY = "bpmn2plugin.rating.shown"
    private const val PROMPT_THRESHOLD = 3
    private const val MARKETPLACE_URL = "https://plugins.jetbrains.com/plugin/21952-bpmn-viewer-free-and-opensource/reviews"

    fun trackOpenAndMaybePrompt(project: Project) {
        val props = PropertiesComponent.getInstance()
        if (props.getBoolean(DISMISSED_KEY, false)) return
        if (props.getBoolean(SHOWN_KEY, false)) return

        val count = props.getInt(OPEN_COUNT_KEY, 0) + 1
        props.setValue(OPEN_COUNT_KEY, count, 0)

        if (count >= PROMPT_THRESHOLD) {
            props.setValue(SHOWN_KEY, true)
            showPrompt(project, props)
        }
    }

    private fun showPrompt(project: Project, props: PropertiesComponent) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("BPMN2 Plugin Rating")
            .createNotification(
                BPMN2Bundle.message("rating.title"),
                BPMN2Bundle.message("rating.message"),
                NotificationType.INFORMATION
            )
            .addAction(object : NotificationAction(BPMN2Bundle.message("rating.action.rate")) {
                override fun actionPerformed(e: AnActionEvent, notification: com.intellij.notification.Notification) {
                    BrowserUtil.browse(MARKETPLACE_URL)
                    props.setValue(DISMISSED_KEY, true)
                    notification.expire()
                }
            })
            .addAction(object : NotificationAction(BPMN2Bundle.message("rating.action.dismiss")) {
                override fun actionPerformed(e: AnActionEvent, notification: com.intellij.notification.Notification) {
                    props.setValue(DISMISSED_KEY, true)
                    notification.expire()
                }
            })
            .notify(project)
    }
}
