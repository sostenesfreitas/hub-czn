package com.hubczn.optimizer.capture

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class CZNAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}

    override fun onServiceConnected() {
        instance = this
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    companion object {
        var instance: CZNAccessibilityService? = null
    }
}
