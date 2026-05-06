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
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.hubczn.optimizer.capture.CaptureService
import com.hubczn.optimizer.capture.CZNAccessibilityService
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
                val overlayGranted by remember { mutableStateOf(Settings.canDrawOverlays(this)) }
                val accessibilityGranted = CZNAccessibilityService.instance != null
                val allGranted = overlayGranted && accessibilityGranted

                Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text("CZN Scanner", style = MaterialTheme.typography.headlineMedium)
                    Text("Grant the following permissions to begin:", style = MaterialTheme.typography.bodyMedium)

                    listOf(
                        PermissionItem(
                            label = "Draw over other apps (Overlay)",
                            granted = overlayGranted,
                            onRequest = { ctx ->
                                ctx.startActivity(
                                    Intent(
                                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                        Uri.parse("package:${ctx.packageName}")
                                    )
                                )
                            }
                        ),
                        PermissionItem(
                            label = "Accessibility Service",
                            granted = accessibilityGranted,
                            onRequest = { ctx ->
                                ctx.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                            }
                        )
                    ).forEach { perm ->
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(if (perm.granted) "✅" else "⬜")
                            Text(perm.label, modifier = Modifier.weight(1f))
                            if (!perm.granted) {
                                TextButton(onClick = { perm.onRequest(this@MainActivity) }) {
                                    Text("Grant")
                                }
                            }
                        }
                    }

                    Spacer(Modifier.weight(1f))

                    if (allGranted) {
                        Text("Select scan type:", style = MaterialTheme.typography.titleMedium)
                        CaptureService.ScanType.entries.forEach { type ->
                            Button(
                                onClick = {
                                    pendingScanType = type
                                    projectionLauncher.launch(projectionManager.createScreenCaptureIntent())
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(type.name.replace("_", " "))
                            }
                        }
                    }
                }
            }
        }
    }
}
