package com.hubczn.optimizer.ui.components

import android.content.Context
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.hubczn.optimizer.R
import com.hubczn.optimizer.capture.CaptureService
import com.hubczn.optimizer.data.local.ScanConfigStore

class ScanOptionsOverlay(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val savedStateRegistryOwner: SavedStateRegistryOwner,
    private val configStore: ScanConfigStore,
    private val scanType: CaptureService.ScanType,
    private val onStart: (bannerIndex: Int, pageLimit: Int?) -> Unit
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var composeView: ComposeView? = null

    private val bannerNames = listOf(
        context.getString(R.string.banner_seasonal),
        context.getString(R.string.banner_general),
        context.getString(R.string.banner_pickup)
    )

    fun show() {
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.CENTER }

        composeView = ComposeView(context).apply {
            setViewTreeLifecycleOwner(lifecycleOwner)
            setViewTreeSavedStateRegistryOwner(savedStateRegistryOwner)
            setContent {
                var selectedBanner by remember { mutableStateOf(configStore.lastBannerIndex) }
                var pageLimitText by remember { mutableStateOf("") }
                val calibX = when (scanType) {
                    CaptureService.ScanType.RESCUE_RECORDS -> configStore.calibRescueX
                    CaptureService.ScanType.MEMORY_FRAGMENTS -> configStore.calibFragmentsX
                    CaptureService.ScanType.COMBATANTS -> configStore.calibCombatantsX
                }
                val isCalibrated = calibX != null

                Column(
                    modifier = Modifier
                        .width(260.dp)
                        .background(Color(0xFF1A1A2E), RoundedCornerShape(14.dp))
                        .border(1.dp, Color(0x44E87A2D), RoundedCornerShape(14.dp))
                        .padding(0.dp)
                ) {
                    // Header
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                Color(0xFF16213E),
                                RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp)
                            )
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val title = when (scanType) {
                            CaptureService.ScanType.RESCUE_RECORDS -> "🎯 Rescue Records"
                            CaptureService.ScanType.MEMORY_FRAGMENTS -> "🧩 Memory Fragments"
                            CaptureService.ScanType.COMBATANTS -> "⚔️ Combatants"
                        }
                        Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .background(Color(0xFF111111), RoundedCornerShape(6.dp))
                                .clickable { dismiss() },
                            contentAlignment = Alignment.Center
                        ) {
                            Text("✕", color = Color(0xFF666666), fontSize = 12.sp)
                        }
                    }

                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {

                        // Banner selector (only for Rescue Records)
                        if (scanType == CaptureService.ScanType.RESCUE_RECORDS) {
                            SectionLabel(stringResource(R.string.label_banner))
                            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                bannerNames.forEachIndexed { idx, name ->
                                    val active = idx == selectedBanner
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(
                                                if (active) Color(0xFF1F1508) else Color(0xFF111827),
                                                RoundedCornerShape(8.dp)
                                            )
                                            .border(
                                                1.dp,
                                                if (active) Color(0xFFE87A2D) else Color(0xFF2a2a4a),
                                                RoundedCornerShape(8.dp)
                                            )
                                            .clickable { selectedBanner = idx }
                                            .padding(horizontal = 10.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(12.dp)
                                                .background(
                                                    if (active) Color(0xFFE87A2D) else Color.Transparent,
                                                    CircleShape
                                                )
                                                .border(2.dp, if (active) Color(0xFFE87A2D) else Color(0xFF444444), CircleShape)
                                        )
                                        Text(name, color = if (active) Color.White else Color(0xFFCCCCCC), fontSize = 11.sp)
                                    }
                                }
                            }
                        }

                        // Page limit
                        SectionLabel(stringResource(R.string.label_page_limit))
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = pageLimitText,
                                onValueChange = { if (it.all(Char::isDigit)) pageLimitText = it },
                                modifier = Modifier.width(80.dp),
                                placeholder = { Text(stringResource(R.string.hint_page_limit), color = Color(0xFF555555)) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = Color(0xFFE87A2D),
                                    unfocusedBorderColor = Color(0xFF2a2a4a),
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White,
                                    cursorColor = Color(0xFFE87A2D)
                                )
                            )
                            Text(stringResource(R.string.label_no_limit), color = Color(0xFF555555), fontSize = 10.sp)
                        }

                        // Calibration
                        SectionLabel(stringResource(R.string.label_calibration))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF111827), RoundedCornerShape(8.dp))
                                .border(1.dp, Color(0xFF2a2a4a), RoundedCornerShape(8.dp))
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(stringResource(R.string.label_next_page_btn), color = Color(0xFFCCCCCC), fontSize = 11.sp)
                                Text(
                                    if (isCalibrated) "✓ Saved" else stringResource(R.string.status_not_calibrated),
                                    color = if (isCalibrated) Color(0xFF4CAF50) else Color(0xFF555555),
                                    fontSize = 9.sp
                                )
                            }
                            TextButton(
                                onClick = {
                                    dismiss()
                                    CalibrationOverlay(context) { x, y ->
                                        when (scanType) {
                                            CaptureService.ScanType.RESCUE_RECORDS -> { configStore.calibRescueX = x; configStore.calibRescueY = y }
                                            CaptureService.ScanType.MEMORY_FRAGMENTS -> { configStore.calibFragmentsX = x; configStore.calibFragmentsY = y }
                                            CaptureService.ScanType.COMBATANTS -> { configStore.calibCombatantsX = x; configStore.calibCombatantsY = y }
                                        }
                                        CaptureService.statusCallback?.invoke("Calibrated: (${x.toInt()}, ${y.toInt()})")
                                    }.show()
                                },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 3.dp),
                                colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFFE87A2D))
                            ) {
                                Text(stringResource(R.string.btn_recalibrate), fontSize = 10.sp)
                            }
                        }

                        // Start button
                        Button(
                            onClick = {
                                if (scanType == CaptureService.ScanType.RESCUE_RECORDS) {
                                    configStore.lastBannerIndex = selectedBanner
                                }
                                val limit = pageLimitText.toIntOrNull()
                                dismiss()
                                onStart(selectedBanner, limit)
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE87A2D))
                        ) {
                            Text(stringResource(R.string.btn_start_scan), fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
        windowManager.addView(composeView, params)
    }

    fun dismiss() {
        composeView?.let { try { windowManager.removeView(it) } catch (_: Exception) {} }
        composeView = null
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, color = Color(0xFFE87A2D), fontSize = 9.sp, letterSpacing = 1.5.sp)
}
