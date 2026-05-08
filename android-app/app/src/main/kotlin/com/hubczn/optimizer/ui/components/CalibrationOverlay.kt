package com.hubczn.optimizer.ui.components

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView

class CalibrationOverlay(
    private val context: Context,
    private val promptText: String = "Tap the  >  (next page) button now",
    private val onCalibrated: (Float, Float) -> Unit
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var root: View? = null

    fun show() {
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        )

        val frame = FrameLayout(context).apply {
            setBackgroundColor(Color.parseColor("#88000000"))
            setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_DOWN) {
                    dismiss()
                    onCalibrated(event.rawX, event.rawY)
                }
                true
            }
        }

        val label = TextView(context).apply {
            text = promptText
            textSize = 22f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#CC1A1A2E"))
            setPadding(48, 32, 48, 32)
        }

        val labelParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        )
        frame.addView(label, labelParams)

        root = frame
        windowManager.addView(frame, params)
    }

    fun dismiss() {
        root?.let {
            try { windowManager.removeView(it) } catch (_: Exception) {}
        }
        root = null
    }
}
