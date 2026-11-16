package com.github.shlaikov.intellijbpmn2plugin

import com.intellij.DynamicBundle
import org.jetbrains.annotations.NonNls
import org.jetbrains.annotations.PropertyKey

@NonNls
private const val BUNDLE = "messages.BPMN2Bundle"

object BPMN2Bundle {
    // DynamicBundle(String) is deprecated: the bundle must be told which class(loader) owns the resource.
    private val instance = DynamicBundle(BPMN2Bundle::class.java, BUNDLE)

    @Suppress("SpreadOperator")
    @JvmStatic
    fun message(@PropertyKey(resourceBundle = BUNDLE) key: String, vararg params: Any) =
        instance.getMessage(key, *params)

    @Suppress("SpreadOperator", "unused")
    @JvmStatic
    fun messagePointer(@PropertyKey(resourceBundle = BUNDLE) key: String, vararg params: Any) =
        instance.getLazyMessage(key, *params)
}
