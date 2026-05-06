package com.hubczn.optimizer.capture

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

class GestureDispatcher(private val service: AccessibilityService) {

    suspend fun tap(x: Float, y: Float) {
        val path = Path().apply { moveTo(x, y) }
        val stroke = GestureDescription.StrokeDescription(path, 0, 50)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()

        suspendCancellableCoroutine { cont ->
            service.dispatchGesture(gesture, object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(g: GestureDescription) { cont.resume(Unit) }
                override fun onCancelled(g: GestureDescription) { cont.resume(Unit) }
            }, null)
        }
        delay(800) // wait for animation after tap
    }

    suspend fun swipeUp(x: Float, fromY: Float, toY: Float) {
        val path = Path().apply {
            moveTo(x, fromY)
            lineTo(x, toY)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, 300)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()

        suspendCancellableCoroutine { cont ->
            service.dispatchGesture(gesture, object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(g: GestureDescription) { cont.resume(Unit) }
                override fun onCancelled(g: GestureDescription) { cont.resume(Unit) }
            }, null)
        }
        delay(600)
    }
}
