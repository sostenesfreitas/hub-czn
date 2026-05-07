package com.hubczn.optimizer.ui.components

import android.content.Context
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
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
        ).apply { gravity = Gravity.TOP or Gravity.START; x = 0; y = 200 }

        composeView = ComposeView(context).apply {
            setViewTreeLifecycleOwner(lifecycleOwner)
            setViewTreeSavedStateRegistryOwner(savedStateRegistryOwner)
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
                        .padding(8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        TextButton(onClick = { expanded = !expanded }) {
                            Text("CZN ${if (expanded) "▲" else "▼"}", color = Color.White)
                        }
                        if (expanded) {
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .background(Color(0xFF111111), RoundedCornerShape(6.dp))
                                    .clickable { onClose() },
                                contentAlignment = Alignment.Center
                            ) {
                                Text("✕", color = Color(0xFF666666), fontSize = 12.sp)
                            }
                        }
                    }

                    if (expanded) {
                        ScanButton(stringResource(R.string.menu_rescue_records)) {
                            expanded = false
                            ScanOptionsOverlay(
                                context, lifecycleOwner, savedStateRegistryOwner,
                                configStore, CaptureService.ScanType.RESCUE_RECORDS
                            ) { bannerIdx, limit -> onScanRescue(bannerIdx, limit) }.show()
                        }
                        ScanButton(stringResource(R.string.menu_memory_fragments)) {
                            expanded = false
                            ScanOptionsOverlay(
                                context, lifecycleOwner, savedStateRegistryOwner,
                                configStore, CaptureService.ScanType.MEMORY_FRAGMENTS
                            ) { _, limit -> onScanFragments(limit) }.show()
                        }
                        ScanButton(stringResource(R.string.menu_combatants)) {
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
private fun ScanButton(label: String, onClick: () -> Unit) {
    TextButton(onClick = onClick) {
        Text(label, color = Color.White)
    }
}
