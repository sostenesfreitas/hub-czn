# Android v2 — Plan B: Scan UX + Settings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign MainActivity (Dark Ember), add i18n (EN/PT-BR), SAF folder picker, ScanOptionsOverlay pre-scan dialog, simplified FloatingOverlay with X close button, and page limit support.

**Architecture:** `ScanOptionsOverlay` is a new WindowManager overlay opened when the user taps a scan type — it collects banner, pageLimit, and calibration before starting the scan. `MainActivity` is fully rebuilt in Compose with the Dark Ember palette. Language switching uses `AppCompatDelegate.setApplicationLocales()` (API 33+) with a manual recreate fallback. All settings persist in `ScanConfigStore` (from Plan A).

**Tech Stack:** Kotlin, Jetpack Compose, AppCompatDelegate, SAF (ACTION_OPEN_DOCUMENT_TREE), WindowManager overlays

**Spec:** `docs/superpowers/specs/2026-05-07-android-v2-design.md`

**Depends on:** Plan A must be complete (ScanConfigStore, RescueRecordDatabase)

---

## File Map

| Action | Path |
|--------|------|
| Create | `android-app/app/src/main/res/values/strings.xml` (replace) |
| Create | `android-app/app/src/main/res/values-pt/strings.xml` |
| Modify | `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/MainActivity.kt` |
| Create  | `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/components/ScanOptionsOverlay.kt` |
| Modify | `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/components/FloatingOverlay.kt` |
| Modify | `android-app/app/src/main/kotlin/com/hubczn/optimizer/capture/CaptureService.kt` |
| Modify | `android-app/app/src/main/AndroidManifest.xml` (add SAF permission + appcompat) |
| Modify | `android-app/gradle/libs.versions.toml` (add appcompat) |
| Modify | `android-app/app/build.gradle.kts` (add appcompat) |

---

## Task 1: i18n String Resources

**Files:**
- Modify: `android-app/app/src/main/res/values/strings.xml`
- Create: `android-app/app/src/main/res/values-pt/strings.xml`

- [ ] **Step 1: Replace values/strings.xml with full EN strings**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">CZN Scanner</string>
    <string name="accessibility_service_description">Automates navigation in Chaos Zero Nightmare to scan game data</string>

    <!-- MainActivity -->
    <string name="title_czn_scanner">CZN Scanner</string>
    <string name="subtitle_chaos_zero">Chaos Zero Nightmare</string>
    <string name="label_permissions">System Permissions</string>
    <string name="perm_overlay">Draw over other apps</string>
    <string name="perm_accessibility">Accessibility Service</string>
    <string name="status_granted">Granted</string>
    <string name="status_pending">Pending</string>
    <string name="btn_grant">Grant</string>
    <string name="label_preferences">Preferences</string>
    <string name="label_language">Language</string>
    <string name="btn_view_history">📊 View History</string>
    <string name="btn_start_scanner">▶  Start Scanner</string>
    <string name="label_output_folder">Output folder</string>
    <string name="btn_change">Change</string>
    <string name="folder_default">Downloads/CZN-Scanner</string>

    <!-- ScanOptionsOverlay -->
    <string name="label_banner">Banner</string>
    <string name="label_page_limit">Page limit</string>
    <string name="hint_page_limit">∞</string>
    <string name="label_no_limit">Empty = no limit</string>
    <string name="label_calibration">Calibration</string>
    <string name="label_next_page_btn">Next page button</string>
    <string name="btn_recalibrate">Recalibrate</string>
    <string name="status_not_calibrated">⬜ Not calibrated</string>
    <string name="btn_start_scan">▶  Start Scan</string>

    <!-- FloatingOverlay -->
    <string name="menu_rescue_records">🎯 Rescue Records</string>
    <string name="menu_memory_fragments">🧩 Memory Fragments</string>
    <string name="menu_combatants">⚔️ Combatants</string>
    <string name="overlay_ready">Ready — tap to scan</string>

    <!-- Banners -->
    <string name="banner_seasonal">Seasonal Combatant</string>
    <string name="banner_general">Gacha General</string>
    <string name="banner_pickup">Gacha Pickup Supporter</string>
</resources>
```

- [ ] **Step 2: Create values-pt/strings.xml**

Create directory `android-app/app/src/main/res/values-pt/` and file `strings.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">CZN Scanner</string>
    <string name="accessibility_service_description">Automatiza a navegação em Chaos Zero Nightmare para escanear dados do jogo</string>

    <!-- MainActivity -->
    <string name="title_czn_scanner">CZN Scanner</string>
    <string name="subtitle_chaos_zero">Chaos Zero Nightmare</string>
    <string name="label_permissions">Permissões do Sistema</string>
    <string name="perm_overlay">Exibir sobre outros apps</string>
    <string name="perm_accessibility">Serviço de Acessibilidade</string>
    <string name="status_granted">Concedido</string>
    <string name="status_pending">Pendente</string>
    <string name="btn_grant">Conceder</string>
    <string name="label_preferences">Preferências</string>
    <string name="label_language">Idioma</string>
    <string name="btn_view_history">📊 Ver Histórico</string>
    <string name="btn_start_scanner">▶  Iniciar Scanner</string>
    <string name="label_output_folder">Pasta de saída</string>
    <string name="btn_change">Alterar</string>
    <string name="folder_default">Downloads/CZN-Scanner</string>

    <!-- ScanOptionsOverlay -->
    <string name="label_banner">Banner</string>
    <string name="label_page_limit">Limite de páginas</string>
    <string name="hint_page_limit">∞</string>
    <string name="label_no_limit">Vazio = sem limite</string>
    <string name="label_calibration">Calibração</string>
    <string name="label_next_page_btn">Botão próx. página</string>
    <string name="btn_recalibrate">Recalibrar</string>
    <string name="status_not_calibrated">⬜ Não calibrado</string>
    <string name="btn_start_scan">▶  Iniciar Scan</string>

    <!-- FloatingOverlay -->
    <string name="menu_rescue_records">🎯 Rescue Records</string>
    <string name="menu_memory_fragments">🧩 Memory Fragments</string>
    <string name="menu_combatants">⚔️ Combatants</string>
    <string name="overlay_ready">Pronto — toque para escanear</string>

    <!-- Banners -->
    <string name="banner_seasonal">Seasonal Combatant</string>
    <string name="banner_general">Gacha General</string>
    <string name="banner_pickup">Gacha Pickup Supporter</string>
</resources>
```

- [ ] **Step 3: Verify build compiles**

```bash
cd android-app && ./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add android-app/app/src/main/res/values/strings.xml \
        android-app/app/src/main/res/values-pt/strings.xml
git commit -m "feat: add i18n strings for EN and PT-BR"
```

---

## Task 2: Add AppCompat Dependency (required for setApplicationLocales)

**Files:**
- Modify: `android-app/gradle/libs.versions.toml`
- Modify: `android-app/app/build.gradle.kts`

- [ ] **Step 1: Add appcompat to libs.versions.toml**

```toml
[versions]
appcompat = "1.7.0"

[libraries]
androidx-appcompat = { group = "androidx.appcompat", name = "appcompat", version.ref = "appcompat" }
```

- [ ] **Step 2: Add to app/build.gradle.kts**

```kotlin
dependencies {
    // existing...
    implementation(libs.androidx.appcompat)
}
```

- [ ] **Step 3: Verify**

```bash
./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add android-app/gradle/libs.versions.toml android-app/app/build.gradle.kts
git commit -m "build: add appcompat for locale switching"
```

---

## Task 3: MainActivity — Dark Ember Redesign + Language + SAF

**Files:**
- Modify: `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/MainActivity.kt`

- [ ] **Step 1: Replace MainActivity.kt**

```kotlin
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
import androidx.compose.ui.platform.LocalContext
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

                        // History button (always shown if service was used)
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
```

- [ ] **Step 2: Verify build compiles**

```bash
./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`
Note: `HistoryActivity` reference will cause a compile error until Plan C is implemented. Add a temporary stub:

```kotlin
// Temporary stub in MainActivity.kt — remove in Plan C
class HistoryActivity : ComponentActivity() {
    override fun onCreate(s: Bundle?) { super.onCreate(s); finish() }
}
```

- [ ] **Step 3: Commit**

```bash
git add android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/MainActivity.kt
git commit -m "feat: MainActivity Dark Ember redesign with i18n toggle and SAF folder picker"
```

---

## Task 4: ScanOptionsOverlay

**Files:**
- Create: `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/components/ScanOptionsOverlay.kt`

- [ ] **Step 1: Create ScanOptionsOverlay.kt**

```kotlin
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
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
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
```

- [ ] **Step 2: Verify build compiles**

```bash
./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/components/ScanOptionsOverlay.kt
git commit -m "feat: add ScanOptionsOverlay with banner picker, page limit, and calibration"
```

---

## Task 5: Update FloatingOverlay — X Button + Wire ScanOptionsOverlay

**Files:**
- Modify: `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/components/FloatingOverlay.kt`

- [ ] **Step 1: Replace FloatingOverlay.kt**

```kotlin
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
```

- [ ] **Step 2: Update CaptureService to wire new FloatingOverlay + configStore**

In `CaptureService.onCreate()`, update the `FloatingOverlay` constructor call:

```kotlin
override fun onCreate() {
    super.onCreate()
    ocrEngine = MLKitOCREngine()
    serviceLifecycleOwner.start()

    val store = ScanConfigStore(this)
    overlay = FloatingOverlay(
        context = this,
        lifecycleOwner = serviceLifecycleOwner,
        savedStateRegistryOwner = serviceLifecycleOwner,
        configStore = store,
        onScanRescue = { bannerIdx, limit -> startScan(ScanType.RESCUE_RECORDS, bannerIdx, limit) },
        onScanFragments = { limit -> startScan(ScanType.MEMORY_FRAGMENTS, pageLimit = limit) },
        onScanCombatants = { limit -> startScan(ScanType.COMBATANTS, pageLimit = limit) },
        onClose = { stopSelf() }
    )
    overlay?.show()
}
```

Update `startScan` signature:
```kotlin
private fun startScan(scanType: ScanType, bannerIndex: Int = 0, pageLimit: Int? = null) {
```

Update the RESCUE_RECORDS branch to use the passed `bannerIndex`:
```kotlin
ScanType.RESCUE_RECORDS -> {
    val bannerName = BANNER_NAMES[bannerIndex]
    // ... rest unchanged, pass pageLimit to RescueRecordScanner
    val records = RescueRecordScanner(sm, ocr, gestures, bannerName, pageLimit) { notifyStatus(it) }.scan()
    // ... DB upsert unchanged ...
}
```

Also update RESCUE_RECORDS branch in `startScan` to read calibration from `ScanConfigStore` instead of `CaptureService.calibratedNextX`:
- In `RescueRecordScanner.findNextButtonCoords()`, replace `CaptureService.calibratedNextX` with a constructor-injected parameter `calibX`/`calibY`.

Add to `RescueRecordScanner` constructor:
```kotlin
private val calibX: Float? = null,
private val calibY: Float? = null,
```

Update `findNextButtonCoords`:
```kotlin
if (calibX != null && calibY != null) return calibX to calibY
```

In `CaptureService.startScan`, pass calibration from `configStore`:
```kotlin
val store = ScanConfigStore(this)
val records = RescueRecordScanner(
    sm, ocr, gestures,
    selectedBanner = bannerName,
    pageLimit = pageLimit,
    calibX = store.calibRescueX,
    calibY = store.calibRescueY
) { notifyStatus(it) }.scan()
```

- [ ] **Step 3: Verify build**

```bash
./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/components/FloatingOverlay.kt \
        android-app/app/src/main/kotlin/com/hubczn/optimizer/capture/CaptureService.kt \
        android-app/app/src/main/kotlin/com/hubczn/optimizer/logic/RescueRecordScanner.kt
git commit -m "feat: simplified FloatingOverlay with X close, ScanOptionsOverlay integration"
```

---

## Verification

- [ ] **Run all tests**

```bash
./gradlew testDebugUnitTest
```
Expected: All tests pass

- [ ] **Install and smoke test on device**

```bash
./gradlew installDebug
```

Manual test flow:
1. Open app → Dark Ember layout visible
2. Toggle PT-BR → strings switch to Portuguese
3. Tap "Alterar" folder → SAF picker opens
4. Grant permissions → Start Scanner button appears
5. Start Scanner → floating overlay appears with ✕ button
6. Tap "Rescue Records" → ScanOptionsOverlay opens with 3 banners
7. Tap ✕ on ScanOptionsOverlay → closes without starting scan
8. Tap "⚔️ Combatants" → ScanOptionsOverlay opens without banner section
9. Tap ✕ on FloatingOverlay → service stops
