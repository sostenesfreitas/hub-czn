package com.hubczn.optimizer.ui

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import java.util.Locale
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.foundation.Image
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.os.LocaleListCompat
import com.composables.icons.lucide.Accessibility
import com.composables.icons.lucide.Check
import com.composables.icons.lucide.Folder
import com.composables.icons.lucide.History
import com.composables.icons.lucide.Languages
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Monitor
import com.composables.icons.lucide.Play
import com.composables.icons.lucide.Puzzle
import com.composables.icons.lucide.Sparkles
import com.composables.icons.lucide.Users
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
        if (configStore.languageOverride == lang) return
        configStore.languageOverride = lang
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(lang))
        // ComponentActivity does not auto-rewrap its base Context with the new locale,
        // so a plain recreate() would re-render with the OLD locale resources.
        // attachBaseContext below picks up the new languageOverride on the recreated activity.
        recreate()
    }

    override fun attachBaseContext(newBase: Context) {
        val lang = ScanConfigStore(newBase).languageOverride
        if (lang.isNullOrEmpty()) {
            super.attachBaseContext(newBase)
            return
        }
        val locale = Locale.forLanguageTag(lang)
        Locale.setDefault(locale)
        val config = Configuration(newBase.resources.configuration)
        config.setLocale(locale)
        super.attachBaseContext(newBase.createConfigurationContext(config))
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
                                    .background(Color.Black, RoundedCornerShape(10.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Image(
                                    painter = painterResource(R.drawable.ic_czn_logo),
                                    contentDescription = null,
                                    modifier = Modifier.size(28.dp)
                                )
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
                            icon = Lucide.Monitor,
                            label = stringResource(R.string.perm_overlay),
                            granted = overlayGranted,
                            onGrant = {
                                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
                            }
                        )
                        Spacer(Modifier.height(6.dp))
                        PermissionCard(
                            icon = Lucide.Accessibility,
                            label = stringResource(R.string.perm_accessibility),
                            granted = accessibilityGranted,
                            onGrant = { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
                        )

                        Spacer(Modifier.height(20.dp))

                        // Preferences section
                        SectionLabel(stringResource(R.string.label_preferences))
                        Spacer(Modifier.height(8.dp))

                        // Language toggle
                        SettingCard(icon = Lucide.Languages, label = stringResource(R.string.label_language)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                LangChip("EN", currentLang == "en") { applyLanguage("en") }
                                LangChip("PT-BR", currentLang == "pt") { applyLanguage("pt") }
                            }
                        }

                        Spacer(Modifier.height(6.dp))

                        // Output folder
                        SettingCard(icon = Lucide.Folder, label = stringResource(R.string.label_output_folder)) {
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
                            Icon(Lucide.History, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(stringResource(R.string.btn_view_history))
                        }

                        Spacer(Modifier.height(6.dp))

                        // Combatants button
                        OutlinedButton(
                            onClick = { startActivity(Intent(this@MainActivity, CombatantsActivity::class.java)) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFC084FC)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x55C084FC))
                        ) {
                            Icon(Lucide.Users, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("View Combatants")
                        }

                        Spacer(Modifier.height(6.dp))

                        // Memory Fragments button
                        OutlinedButton(
                            onClick = { startActivity(Intent(this@MainActivity, FragmentsActivity::class.java)) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFC084FC)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x55C084FC))
                        ) {
                            Icon(Lucide.Puzzle, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("View Fragments")
                        }

                        Spacer(Modifier.height(6.dp))

                        // Optimizer button
                        OutlinedButton(
                            onClick = { startActivity(Intent(this@MainActivity, OptimizerActivity::class.java)) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFC084FC)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x55C084FC))
                        ) {
                            Icon(Lucide.Sparkles, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Optimizer")
                        }

                        Spacer(Modifier.height(8.dp))

                        // Start Scanner button
                        if (allGranted) {
                            Button(
                                onClick = {
                                    // The game runs in landscape; force this Activity to
                                    // landscape BEFORE asking for screen-capture permission
                                    // so MediaProjection is granted with landscape dimensions.
                                    // Without this, MainActivity is portrait, MediaProjection
                                    // captures portrait frames, and tap coords are mis-mapped
                                    // once the user switches to the landscape game.
                                    requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                                    projectionLauncher.launch(projectionManager.createScreenCaptureIntent())
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE87A2D))
                            ) {
                                Icon(Lucide.Play, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(8.dp))
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
private fun PermissionCard(icon: ImageVector, label: String, granted: Boolean, onGrant: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1A1A2E), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Icon(icon, contentDescription = null, tint = Color(0xFFE87A2D), modifier = Modifier.size(18.dp))
        Text(label, color = Color(0xFFCCCCCC), fontSize = 12.sp, modifier = Modifier.weight(1f))
        if (granted) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                modifier = Modifier
                    .background(Color(0xFF1D3A1D), RoundedCornerShape(4.dp))
                    .padding(horizontal = 8.dp, vertical = 3.dp)
            ) {
                Icon(Lucide.Check, contentDescription = null, tint = Color(0xFF4CAF50), modifier = Modifier.size(12.dp))
                Text("OK", color = Color(0xFF4CAF50), fontSize = 10.sp)
            }
        } else {
            TextButton(onClick = onGrant, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)) {
                Text("Grant", color = Color(0xFFE87A2D), fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun SettingCard(icon: ImageVector, label: String, trailing: @Composable () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1A1A2E), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Icon(icon, contentDescription = null, tint = Color(0xFFE87A2D), modifier = Modifier.size(16.dp))
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
