package com.hubczn.optimizer.ui.components

import android.content.Context
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.composables.icons.lucide.ChevronDown
import com.composables.icons.lucide.ChevronUp
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Puzzle
import com.composables.icons.lucide.Swords
import com.composables.icons.lucide.Target
import com.composables.icons.lucide.X
import com.hubczn.optimizer.R
import com.hubczn.optimizer.capture.CaptureService
import com.hubczn.optimizer.data.local.ScanConfigStore

class FloatingOverlay(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val savedStateRegistryOwner: SavedStateRegistryOwner,
    private val configStore: ScanConfigStore,
    private val onScanRescue: (bannerIndex: Int, pageLimit: Int?) -> Unit,
    private val onScanFragments: (pageLimit: Int?) -> Unit,
    private val onScanCombatants: (pageLimit: Int?) -> Unit,
    private val onClose: () -> Unit
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var composeView: ComposeView? = null

    fun show() {
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = configStore.overlayX
            y = configStore.overlayY
        }

        composeView = ComposeView(context).apply {
            setViewTreeLifecycleOwner(lifecycleOwner)
            setViewTreeSavedStateRegistryOwner(savedStateRegistryOwner)
            val viewRef = this
            setContent {
                var expanded by remember { mutableStateOf(false) }
                var status by remember { mutableStateOf(context.getString(R.string.overlay_ready)) }

                DisposableEffect(Unit) {
                    CaptureService.statusCallback = { msg -> status = msg }
                    onDispose { CaptureService.statusCallback = null }
                }

                Column(
                    modifier = Modifier
                        .background(Color(0xCC1A1A2E), RoundedCornerShape(12.dp))
                        .pointerInput(Unit) {
                            // Drag the whole overlay around the screen.
                            // detectDragGestures only fires after a small touch-slop
                            // movement, so taps still pass through to inner buttons.
                            detectDragGestures { change, dragAmount ->
                                change.consume()
                                params.x += dragAmount.x.toInt()
                                params.y += dragAmount.y.toInt()
                                try {
                                    windowManager.updateViewLayout(viewRef, params)
                                    configStore.overlayX = params.x
                                    configStore.overlayY = params.y
                                } catch (_: Exception) { /* view may have been removed */ }
                            }
                        }
                        .padding(8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        TextButton(onClick = { expanded = !expanded }) {
                            Text("CZN", color = Color.White)
                            Spacer(Modifier.width(4.dp))
                            Icon(
                                if (expanded) Lucide.ChevronUp else Lucide.ChevronDown,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                        if (expanded) {
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .background(Color(0xFF111111), RoundedCornerShape(6.dp))
                                    .clickable { onClose() },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Lucide.X, contentDescription = "Close", tint = Color(0xFF666666), modifier = Modifier.size(12.dp))
                            }
                        }
                    }

                    if (expanded) {
                        ScanButton(Lucide.Target, stringResource(R.string.menu_rescue_records)) {
                            expanded = false
                            ScanOptionsOverlay(
                                context, lifecycleOwner, savedStateRegistryOwner,
                                configStore, CaptureService.ScanType.RESCUE_RECORDS
                            ) { bannerIdx, limit -> onScanRescue(bannerIdx, limit) }.show()
                        }
                        ScanButton(Lucide.Puzzle, stringResource(R.string.menu_memory_fragments)) {
                            expanded = false
                            ScanOptionsOverlay(
                                context, lifecycleOwner, savedStateRegistryOwner,
                                configStore, CaptureService.ScanType.MEMORY_FRAGMENTS
                            ) { _, limit -> onScanFragments(limit) }.show()
                        }
                        ScanButton(Lucide.Swords, stringResource(R.string.menu_combatants)) {
                            expanded = false
                            ScanOptionsOverlay(
                                context, lifecycleOwner, savedStateRegistryOwner,
                                configStore, CaptureService.ScanType.COMBATANTS
                            ) { _, limit -> onScanCombatants(limit) }.show()
                        }
                    }
                    Text(status, color = Color(0xFFE87A2D), style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        windowManager.addView(composeView, params)
    }

    fun dismiss() {
        composeView?.let { windowManager.removeView(it) }
        composeView = null
    }
}

@Composable
private fun ScanButton(icon: ImageVector, label: String, onClick: () -> Unit) {
    TextButton(onClick = onClick) {
        Icon(icon, contentDescription = null, tint = Color(0xFFE87A2D), modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(8.dp))
        Text(label, color = Color.White)
    }
}
