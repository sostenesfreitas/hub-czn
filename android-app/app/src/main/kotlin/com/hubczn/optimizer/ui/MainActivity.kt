package com.hubczn.optimizer.ui

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.os.LocaleListCompat
import com.hubczn.optimizer.R
import com.hubczn.optimizer.capture.CaptureService
import com.hubczn.optimizer.capture.CZNAccessibilityService
import com.hubczn.optimizer.data.local.ScanConfigStore
import com.hubczn.optimizer.ui.theme.CZNScannerTheme

class MainActivity : ComponentActivity() {

    private val projectionManager by lazy {
        getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    }
    private val configStore by lazy { ScanConfigStore(this) }

    private val overlayGrantedState = mutableStateOf(false)
    private val accessibilityGrantedState = mutableStateOf(false)
    private val outputFolderLabelState = mutableStateOf("")

    private val projectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            startForegroundService(Intent(this, CaptureService::class.java).apply {
                putExtra(CaptureService.EXTRA_RESULT_CODE, result.resultCode)
                putExtra(CaptureService.EXTRA_PROJECTION_DATA, result.data)
            })
            finish()
        }
    }

    private val folderPickerLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri: Uri? ->
        if (uri != null) {
            contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            configStore.outputFolderUri = uri
            outputFolderLabelState.value = uri.lastPathSegment ?: uri.toString()
        }
    }

    override fun onResume() {
        super.onResume()
        overlayGrantedState.value = Settings.canDrawOverlays(this)
        accessibilityGrantedState.value = isAccessibilityServiceEnabled()
        outputFolderLabelState.value = configStore.outputFolderUri
            ?.lastPathSegment
            ?: getString(R.string.folder_default)
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expected = ComponentName(this, CZNAccessibilityService::class.java).flattenToString()
        val enabled = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        return enabled?.split(":")?.any { it.equals(expected, ignoreCase = true) } == true
    }

    private fun applyLanguage(lang: String) {
        configStore.languageOverride = lang
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(lang))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Apply persisted language before UI is created
        configStore.languageOverride?.let {
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(it))
        }
        super.onCreate(savedInstanceState)

        setContent {
            CZNScannerTheme {
                val overlayGranted by overlayGrantedState
                val accessibilityGranted by accessibilityGrantedState
                val allGranted = overlayGranted && accessibilityGranted
                val folderLabel by outputFolderLabelState
                val currentLang = configStore.languageOverride ?: "en"

                // Dark Ember background
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xFF0D0D1A))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(0.dp)
                    ) {
                        // Header
                        Spacer(Modifier.height(24.dp))
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(Color(0xFFE87A2D), RoundedCornerShape(10.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("C", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                            }
                            Column {
                                Text(
                                    stringResource(R.string.title_czn_scanner),
                                    color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp
                                )
                                Text(
                                    stringResource(R.string.subtitle_chaos_zero),
                                    color = Color(0xFFE87A2D), fontSize = 11.sp, letterSpacing = 1.sp
                                )
                            }
                        }

                        Spacer(Modifier.height(28.dp))

                        // Permissions section
                        SectionLabel(stringResource(R.string.label_permissions))
                        Spacer(Modifier.height(8.dp))

                        PermissionCard(
                            icon = "🖥️",
                            label = stringResource(R.string.perm_overlay),
                            granted = overlayGranted,
                            onGrant = {
                                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
                            }
                        )
                        Spacer(Modifier.height(6.dp))
                        PermissionCard(
                            icon = "♿",
                            label = stringResource(R.string.perm_accessibility),
                            granted = accessibilityGranted,
                            onGrant = { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
                        )

                        Spacer(Modifier.height(20.dp))

                        // Preferences section
                        SectionLabel(stringResource(R.string.label_preferences))
                        Spacer(Modifier.height(8.dp))

                        // Language toggle
                        SettingCard(icon = "🌐", label = stringResource(R.string.label_language)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                LangChip("EN", currentLang == "en") { applyLanguage("en") }
                                LangChip("PT-BR", currentLang == "pt") { applyLanguage("pt") }
                            }
                        }

                        Spacer(Modifier.height(6.dp))

                        // Output folder
                        SettingCard(icon = "📁", label = stringResource(R.string.label_output_folder)) {
                            Column(horizontalAlignment = Alignment.End) {
                                Text(folderLabel, color = Color(0xFF888888), fontSize = 10.sp)
                                TextButton(
                                    onClick = { folderPickerLauncher.launch(null) },
                                    contentPadding = PaddingValues(0.dp)
                                ) {
                                    Text(stringResource(R.string.btn_change), color = Color(0xFFE87A2D), fontSize = 11.sp)
                                }
                            }
                        }

                        Spacer(Modifier.weight(1f))

                        // History button (always shown)
                        OutlinedButton(
                            onClick = { startActivity(Intent(this@MainActivity, HistoryActivity::class.java)) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFE87A2D)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x55E87A2D))
                        ) {
                            Text(stringResource(R.string.btn_view_history))
                        }

                        Spacer(Modifier.height(8.dp))

                        // Start Scanner button
                        if (allGranted) {
                            Button(
                                onClick = { projectionLauncher.launch(projectionManager.createScreenCaptureIntent()) },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE87A2D))
                            ) {
                                Text(stringResource(R.string.btn_start_scanner), fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, color = Color(0xFFE87A2D), fontSize = 10.sp, letterSpacing = 1.5.sp,
        modifier = Modifier.padding(start = 2.dp))
}

@Composable
private fun PermissionCard(icon: String, label: String, granted: Boolean, onGrant: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1A1A2E), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(icon, fontSize = 16.sp)
        Text(label, color = Color(0xFFCCCCCC), fontSize = 12.sp, modifier = Modifier.weight(1f))
        if (granted) {
            Text("✓ OK", color = Color(0xFF4CAF50), fontSize = 10.sp,
                modifier = Modifier
                    .background(Color(0xFF1D3A1D), RoundedCornerShape(4.dp))
                    .padding(horizontal = 8.dp, vertical = 3.dp))
        } else {
            TextButton(onClick = onGrant, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)) {
                Text("Grant", color = Color(0xFFE87A2D), fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun SettingCard(icon: String, label: String, trailing: @Composable () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1A1A2E), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(icon, fontSize = 14.sp)
        Text(label, color = Color(0xFFCCCCCC), fontSize = 12.sp, modifier = Modifier.weight(1f))
        trailing()
    }
}

@Composable
private fun LangChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val bg = if (selected) Color(0xFF1F1508) else Color(0xFF111827)
    val border = if (selected) Color(0xFFE87A2D) else Color(0xFF2a2a4a)
    val text = if (selected) Color(0xFFE87A2D) else Color(0xFF888888)
    TextButton(
        onClick = onClick,
        modifier = Modifier
            .background(bg, RoundedCornerShape(6.dp))
            .padding(0.dp),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
        colors = ButtonDefaults.textButtonColors(contentColor = text)
    ) {
        Text(label, fontSize = 11.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal)
    }
}
