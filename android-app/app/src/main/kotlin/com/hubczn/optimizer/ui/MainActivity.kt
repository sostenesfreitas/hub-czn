package com.hubczn.optimizer.ui

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import com.hubczn.optimizer.capture.CaptureService
import com.hubczn.optimizer.capture.CZNAccessibilityService
import com.hubczn.optimizer.ui.components.PermissionsScreen
import com.hubczn.optimizer.ui.components.PermissionItem
import com.hubczn.optimizer.ui.theme.CZNScannerTheme

class MainActivity : ComponentActivity() {

    private val projectionManager by lazy {
        getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    }

    private var pendingScanType: CaptureService.ScanType? = null

    private val projectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val intent = Intent(this, CaptureService::class.java).apply {
                putExtra(CaptureService.EXTRA_RESULT_CODE, result.resultCode)
                putExtra(CaptureService.EXTRA_PROJECTION_DATA, result.data)
                putExtra(CaptureService.EXTRA_SCAN_TYPE, pendingScanType)
            }
            startForegroundService(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CZNScannerTheme {
                var overlayGranted by remember { mutableStateOf(Settings.canDrawOverlays(this)) }
                val accessibilityGranted = CZNAccessibilityService.instance != null

                val permissions = listOf(
                    PermissionItem(
                        label = "Draw over other apps (Overlay)",
                        granted = overlayGranted,
                        onRequest = { ctx ->
                            ctx.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                Uri.parse("package:${ctx.packageName}")))
                        }
                    ),
                    PermissionItem(
                        label = "Accessibility Service",
                        granted = accessibilityGranted,
                        onRequest = { ctx ->
                            ctx.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                        }
                    )
                )

                PermissionsScreen(
                    permissions = permissions,
                    onStartScanner = {
                        pendingScanType = CaptureService.ScanType.RESCUE_RECORDS
                        projectionLauncher.launch(projectionManager.createScreenCaptureIntent())
                    }
                )
            }
        }
    }
}
