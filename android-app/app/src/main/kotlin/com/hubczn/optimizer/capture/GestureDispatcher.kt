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

    /** Triggers the system back action (equivalent to the Android back button). */
    suspend fun pressBack() {
        service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
        delay(600)
    }

    /**
     * Drag from [fromY] to [toY] at column [x]. [durationMs] controls the
     * stroke speed: short (~300ms) produces a flick that the scroll view
     * interprets as a fling, scrolling far past the gesture distance;
     * longer (~800ms+) produces a slow drag with no inertia, scrolling
     * exactly the gesture distance. Use the slower mode whenever you need
     * the post-swipe content to overlap the pre-swipe content (e.g. to
     * walk a roster row-by-row without skipping any).
     */
    suspend fun swipeUp(x: Float, fromY: Float, toY: Float, durationMs: Long = 300) {
        val path = Path().apply {
            moveTo(x, fromY)
            lineTo(x, toY)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
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
