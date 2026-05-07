package com.hubczn.optimizer.ui.components

import android.content.Context
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import com.hubczn.optimizer.capture.CaptureService
import com.hubczn.optimizer.data.local.ScanConfigStore
import com.hubczn.optimizer.ui.components.CalibrationOverlay
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.unit.dp
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner

class FloatingOverlay(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val savedStateRegistryOwner: SavedStateRegistryOwner,
    private val onScanRescue: () -> Unit,
    private val onScanFragments: () -> Unit,
    private val onScanCombatants: () -> Unit
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var composeView: ComposeView? = null
    private val configStore = ScanConfigStore(context)

    fun show() {
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.START; x = 0; y = 200 }

        composeView = ComposeView(context).apply {
            setViewTreeLifecycleOwner(lifecycleOwner)
            setViewTreeSavedStateRegistryOwner(savedStateRegistryOwner)
            setContent {
                var expanded by remember { mutableStateOf(false) }
                var status by remember { mutableStateOf("Ready") }

                DisposableEffect(Unit) {
                    CaptureService.statusCallback = { msg -> status = msg }
                    onDispose { CaptureService.statusCallback = null }
                }

                Column(
                    modifier = Modifier
                        .background(Color(0xCC1A1A2E), RoundedCornerShape(12.dp))
                        .padding(8.dp)
                ) {
                    TextButton(onClick = { expanded = !expanded }) {
                        Text("CZN ${if (expanded) "▲" else "▼"}", color = Color.White)
                    }
                    if (expanded) {
                        TextButton(onClick = { expanded = false; onScanRescue() }) {
                            Text("Rescue Records", color = Color.White)
                        }
                        TextButton(onClick = { expanded = false; onScanFragments() }) {
                            Text("Memory Fragments", color = Color.White)
                        }
                        TextButton(onClick = { expanded = false; onScanCombatants() }) {
                            Text("Combatants", color = Color.White)
                        }
                        val calDone = configStore.calibRescueX != null
                        TextButton(onClick = {
                            expanded = false
                            CalibrationOverlay(context) { x, y ->
                                configStore.calibRescueX = x
                                configStore.calibRescueY = y
                                CaptureService.statusCallback?.invoke("Calibrated: next page at (${x.toInt()}, ${y.toInt()})")
                            }.show()
                        }) {
                            Text(if (calDone) "✅ Cal >" else "⬜ Cal >", color = Color.White)
                        }
                    }
                    Text(status, color = Color(0xFFE87A2D), style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        windowManager.addView(composeView, params)
    }

    fun updateStatus(status: String) {
        // Status is updated via CaptureService.statusCallback → triggers recomposition
    }

    fun dismiss() {
        composeView?.let { windowManager.removeView(it) }
        composeView = null
    }
}
