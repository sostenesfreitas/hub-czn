# Android v2 — Plan C: History Screen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full Rescue Records history screen to the Android app with stats, 5★ portrait grid, pull list, Export JSON, and Save to Cloud buttons — matching the desktop frontend.

**Architecture:** `HistoryActivity` is a standard Compose Activity querying `RescueRecordDao` directly. Stats (pity, averages) are computed in a `HistoryViewModel`. Portrait images are loaded from `assets/faces/` using `BitmapFactory`. "Save to Cloud" opens `https://hub-czn.lovable.app` in the system browser.

**Tech Stack:** Kotlin, Jetpack Compose, Room (DAO from Plan A), ViewModel, BitmapFactory, Intent.ACTION_VIEW

**Spec:** `docs/superpowers/specs/2026-05-07-android-v2-design.md`

**Depends on:** Plan A (Room DB, CharacterRepository, JSONExporter), Plan B (MainActivity stub removal)

---

## File Map

| Action | Path |
|--------|------|
| Create (script) | `scripts/copy_portraits.py` |
| Create (assets) | `android-app/app/src/main/assets/faces/*.png` (72 files) |
| Create | `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/HistoryViewModel.kt` |
| Create | `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/HistoryActivity.kt` |
| Modify | `android-app/app/src/main/AndroidManifest.xml` |
| Modify | `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/MainActivity.kt` (remove stub) |
| Modify | `android-app/gradle/libs.versions.toml` (add lifecycle-viewmodel-compose) |
| Modify | `android-app/app/build.gradle.kts` |
| Create | `android-app/app/src/test/kotlin/com/hubczn/optimizer/ui/HistoryViewModelTest.kt` |

---

## Task 1: Copy Portrait Assets from Desktop Project

**Files:**
- Create: `scripts/copy_portraits.py`
- Create: `android-app/app/src/main/assets/faces/` (72 PNG files)

- [ ] **Step 1: Create copy script**

Create `scripts/copy_portraits.py`:

```python
#!/usr/bin/env python3
"""Copy character portrait PNGs from desktop project to Android assets."""
import os
import shutil

SRC = os.path.join(os.path.dirname(__file__), "..", "api", "assets", "game", "faces")
DST = os.path.join(os.path.dirname(__file__), "..", "android-app", "app", "src", "main", "assets", "faces")

os.makedirs(DST, exist_ok=True)
copied = 0
for fname in os.listdir(SRC):
    if fname.endswith(".png"):
        shutil.copy2(os.path.join(SRC, fname), os.path.join(DST, fname))
        copied += 1

print(f"Copied {copied} portrait files to {DST}")
```

- [ ] **Step 2: Run the script**

```bash
cd C:/Users/soste/Documents/Vribbels-CZN-Optimizer/.worktrees/android-ocr-scanner
python scripts/copy_portraits.py
```
Expected: `Copied 72 portrait files to .../assets/faces`

- [ ] **Step 3: Verify files exist**

```bash
python -c "
import os
faces = os.listdir('android-app/app/src/main/assets/faces')
print(f'{len(faces)} portrait files')
print('Sample:', faces[:3])
"
```
Expected: `72 portrait files`

- [ ] **Step 4: Commit**

```bash
git add scripts/copy_portraits.py android-app/app/src/main/assets/faces/
git commit -m "feat: copy 72 character portrait assets from desktop project"
```

---

## Task 2: Add ViewModel Dependency

**Files:**
- Modify: `android-app/gradle/libs.versions.toml`
- Modify: `android-app/app/build.gradle.kts`

- [ ] **Step 1: Add lifecycle-viewmodel-compose and lifecycle-runtime-compose to libs.versions.toml**

```toml
[versions]
lifecycleViewmodel = "2.8.1"

[libraries]
androidx-lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycleViewmodel" }
androidx-lifecycle-runtime-compose = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycleViewmodel" }
```

- [ ] **Step 2: Add to app/build.gradle.kts**

```kotlin
dependencies {
    // existing...
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
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
git commit -m "build: add lifecycle-viewmodel-compose dependency"
```

---

## Task 3: HistoryViewModel

**Files:**
- Create: `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/HistoryViewModel.kt`
- Create: `android-app/app/src/test/kotlin/com/hubczn/optimizer/ui/HistoryViewModelTest.kt`

- [ ] **Step 1: Write failing tests**

Create `android-app/app/src/test/kotlin/com/hubczn/optimizer/ui/HistoryViewModelTest.kt`:

```kotlin
package com.hubczn.optimizer.ui

import com.hubczn.optimizer.data.local.RescueRecordEntity
import org.junit.Assert.*
import org.junit.Test

class HistoryViewModelTest {

    private fun record(
        name: String = "Akad",
        rarity: Int = 4,
        bannerName: String = "Seasonal Combatant Rescue Rate-Up",
        pullNumber: Long = 1L,
        isFeatured: Boolean = false
    ) = RescueRecordEntity(
        bannerName = bannerName,
        name = name,
        type = "Partners",
        createAt = "2026-04-29 08:16:56",
        rescueType = bannerName,
        isFeatured = isFeatured,
        duplicateIdx = 0,
        resId = 20007,
        rarity = rarity,
        pullNumber = pullNumber
    )

    @Test
    fun `computeStats total is correct`() {
        val records = listOf(record(), record(name = "B"), record(name = "C"))
        val stats = HistoryViewModel.computeStats(records)
        assertEquals(3, stats.total)
    }

    @Test
    fun `computeStats fiveStar count`() {
        val records = listOf(record(rarity = 5), record(rarity = 4), record(rarity = 3))
        val stats = HistoryViewModel.computeStats(records)
        assertEquals(1, stats.fiveStar)
        assertEquals(1, stats.fourStar)
    }

    @Test
    fun `computeStats resourcesSpent is total times 160`() {
        val records = listOf(record(), record(), record())
        val stats = HistoryViewModel.computeStats(records)
        assertEquals(480, stats.resourcesSpent)
    }

    @Test
    fun `computeStats avgPity5 is correct`() {
        // Records in order: 5* at pull 3, then 5* at pull 2 = pities 3 and 2
        val records = (1..3).map { record(rarity = if (it == 3) 5 else 4, pullNumber = it.toLong()) } +
                      (4..5).map { record(rarity = if (it == 5) 5 else 3, pullNumber = it.toLong()) }
        val stats = HistoryViewModel.computeStats(records)
        // Pity resets after 5*: first 5* at pull 3 (pity=3), second at pull 5 (pity=2)
        assertEquals(2.5f, stats.avgPity5, 0.01f)
    }

    @Test
    fun `fiveStarRecords returns only rarity 5`() {
        val records = listOf(record(rarity = 5), record(rarity = 4), record(rarity = 5))
        val fiveStars = HistoryViewModel.fiveStarRecords(records)
        assertEquals(2, fiveStars.size)
        assertTrue(fiveStars.all { it.rarity == 5 })
    }
}
```

- [ ] **Step 2: Run to verify tests fail**

```bash
./gradlew testDebugUnitTest --tests "com.hubczn.optimizer.ui.HistoryViewModelTest"
```
Expected: FAILED — `HistoryViewModel` not found

- [ ] **Step 3: Implement HistoryViewModel**

Create `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/HistoryViewModel.kt`:

```kotlin
package com.hubczn.optimizer.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hubczn.optimizer.data.local.RescueRecordDatabase
import com.hubczn.optimizer.data.local.RescueRecordEntity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class BannerStats(
    val total: Int,
    val fiveStar: Int,
    val fourStar: Int,
    val resourcesSpent: Int,
    val avgPity5: Float,
    val avgPity4: Float
)

class HistoryViewModel(app: Application) : AndroidViewModel(app) {
    private val dao = RescueRecordDatabase.getInstance(app).rescueRecordDao()

    private val _records = MutableStateFlow<List<RescueRecordEntity>>(emptyList())
    val records: StateFlow<List<RescueRecordEntity>> = _records

    private val _selectedBannerIdx = MutableStateFlow(0)
    val selectedBannerIdx: StateFlow<Int> = _selectedBannerIdx

    val bannerNames = listOf(
        "Seasonal Combatant Rescue Rate-Up",
        "Gacha General",
        "Gacha Pickup Supporter"
    )

    init {
        loadRecords()
    }

    fun selectBanner(idx: Int) { _selectedBannerIdx.value = idx }

    private fun loadRecords() {
        viewModelScope.launch {
            _records.value = dao.getAllOrderedByPullNumber()
        }
    }

    fun refresh() = loadRecords()

    fun recordsForBanner(bannerIdx: Int): List<RescueRecordEntity> {
        val name = bannerNames.getOrNull(bannerIdx) ?: return emptyList()
        return _records.value.filter { it.bannerName == name }
    }

    companion object {
        fun computeStats(records: List<RescueRecordEntity>): BannerStats {
            var pity5Counter = 0
            var pity4Counter = 0
            val pities5 = mutableListOf<Int>()
            val pities4 = mutableListOf<Int>()

            for (r in records.sortedBy { it.pullNumber }) {
                pity5Counter++
                pity4Counter++
                when (r.rarity) {
                    5 -> { pities5.add(pity5Counter); pity5Counter = 0 }
                    4 -> { pities4.add(pity4Counter); pity4Counter = 0 }
                }
            }

            return BannerStats(
                total = records.size,
                fiveStar = records.count { it.rarity == 5 },
                fourStar = records.count { it.rarity == 4 },
                resourcesSpent = records.size * 160,
                avgPity5 = if (pities5.isEmpty()) 0f else pities5.average().toFloat(),
                avgPity4 = if (pities4.isEmpty()) 0f else pities4.average().toFloat()
            )
        }

        fun fiveStarRecords(records: List<RescueRecordEntity>): List<RescueRecordEntity> =
            records.filter { it.rarity == 5 }.sortedByDescending { it.pullNumber }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
./gradlew testDebugUnitTest --tests "com.hubczn.optimizer.ui.HistoryViewModelTest"
```
Expected: `BUILD SUCCESSFUL`, all 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/HistoryViewModel.kt \
        android-app/app/src/test/kotlin/com/hubczn/optimizer/ui/HistoryViewModelTest.kt
git commit -m "feat: add HistoryViewModel with stats computation"
```

---

## Task 4: HistoryActivity

**Files:**
- Create: `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/HistoryActivity.kt`

- [ ] **Step 1: Create HistoryActivity.kt**

```kotlin
package com.hubczn.optimizer.ui

import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hubczn.optimizer.R
import com.hubczn.optimizer.data.local.RescueRecordDatabase
import com.hubczn.optimizer.data.local.RescueRecordEntity
import com.hubczn.optimizer.data.repository.JSONExporter
import com.hubczn.optimizer.data.local.ScanConfigStore
import com.hubczn.optimizer.ui.theme.CZNScannerTheme
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class HistoryActivity : ComponentActivity() {
    private val viewModel: HistoryViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CZNScannerTheme {
                HistoryScreen(viewModel)
            }
        }
    }
}

@Composable
private fun HistoryScreen(viewModel: HistoryViewModel) {
    val context = LocalContext.current
    val allRecords by viewModel.records.collectAsStateWithLifecycle()
    val selectedBannerIdx by viewModel.selectedBannerIdx.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    var filterRarity by remember { mutableStateOf(0) } // 0=All, 5=5★, 4=4★

    val bannerRecords = viewModel.recordsForBanner(selectedBannerIdx)
    val stats = remember(bannerRecords) { HistoryViewModel.computeStats(bannerRecords) }
    val fiveStars = remember(bannerRecords) { HistoryViewModel.fiveStarRecords(bannerRecords) }
    val filtered = remember(bannerRecords, filterRarity) {
        if (filterRarity == 0) bannerRecords.sortedByDescending { it.pullNumber }
        else bannerRecords.filter { it.rarity == filterRarity }.sortedByDescending { it.pullNumber }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFF0D0D1A))) {
        Column(modifier = Modifier.fillMaxSize()) {

            // Top bar
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF16213E))
                    .padding(start = 14.dp, end = 14.dp, top = 14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Rescue Records", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        ActionChip(
                            label = "⬇ Export JSON",
                            color = Color(0xFFE87A2D)
                        ) {
                            scope.launch {
                                val db = RescueRecordDatabase.getInstance(context)
                                val store = ScanConfigStore(context)
                                val exporter = JSONExporter(context, db.rescueRecordDao(), store.outputFolderUri)
                                exporter.exportRescueRecordsFromDb()
                            }
                        }
                        ActionChip(
                            label = "☁ Save to Cloud",
                            color = Color(0xFF7C9FE8)
                        ) {
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW, Uri.parse("https://hub-czn.lovable.app"))
                            )
                        }
                    }
                }

                // Banner tabs
                Row(modifier = Modifier.fillMaxWidth()) {
                    viewModel.bannerNames.forEachIndexed { idx, name ->
                        val shortName = when (idx) {
                            0 -> "Seasonal Combatant"
                            1 -> "Gacha General"
                            else -> "Pickup Supporter"
                        }
                        val active = idx == selectedBannerIdx
                        Column(
                            modifier = Modifier
                                .clickable { viewModel.selectBanner(idx) }
                                .padding(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Text(
                                shortName,
                                color = if (active) Color(0xFFE87A2D) else Color(0xFF666666),
                                fontSize = 11.sp,
                                fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal
                            )
                            if (active) {
                                Spacer(Modifier.height(3.dp))
                                Box(Modifier.height(2.dp).fillMaxWidth().background(Color(0xFFE87A2D)))
                            }
                        }
                    }
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {

                // Stats card
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF1A1A2E), RoundedCornerShape(12.dp))
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.weight(1f)) {
                            StatRow("Total Pulls", "${stats.total}", Color.White)
                            StatRow("Resources Spent", "${stats.resourcesSpent}", Color(0xFFE87A2D))
                            StatRow("5★ Pulls", "${stats.fiveStar}", Color(0xFFFFD700))
                            StatRow("4★ Pulls", "${stats.fourStar}", Color(0xFFB39DDB))
                            StatRow("Avg 5★ Pity", "${"%.1f".format(stats.avgPity5)}", Color.White)
                            StatRow("Avg 4★ Pity", "${"%.1f".format(stats.avgPity4)}", Color.White)
                        }
                        DonutChart(
                            fiveStar = stats.fiveStar,
                            fourStar = stats.fourStar,
                            total = stats.total,
                            modifier = Modifier.size(70.dp)
                        )
                    }
                }

                // 5★ portrait grid
                if (fiveStars.isNotEmpty()) {
                    item {
                        SectionLabel("Recent 5★ Pulls")
                    }
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(fiveStars) { r ->
                                PortraitTile(r, size = 52)
                            }
                        }
                    }
                }

                // Filter row
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        SectionLabel("Full History")
                        Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            FilterChip("All", filterRarity == 0) { filterRarity = 0 }
                            FilterChip("5★", filterRarity == 5) { filterRarity = 5 }
                            FilterChip("4★", filterRarity == 4) { filterRarity = 4 }
                        }
                    }
                }

                // Pull list
                items(filtered, key = { it.id }) { r ->
                    PullRow(r)
                }
            }
        }
    }
}

@Composable
private fun StatRow(label: String, value: String, valueColor: Color) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = Color(0xFF888888), fontSize = 10.sp)
        Text(value, color = valueColor, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun DonutChart(fiveStar: Int, fourStar: Int, total: Int, modifier: Modifier) {
    // Simple placeholder — replace with Canvas arc drawing for production
    Box(
        modifier = modifier.background(Color(0xFF2a2a4a), RoundedCornerShape(50)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            if (total > 0) "${"%.0f".format(fiveStar * 100f / total)}%",
            color = Color(0xFFFFD700), fontSize = 11.sp, fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun PortraitTile(record: RescueRecordEntity, size: Int) {
    val context = LocalContext.current
    val bitmap = remember(record.resId) {
        runCatching {
            context.assets.open("faces/bookmark_face_character_map_${record.resId}.png")
                .use { BitmapFactory.decodeStream(it) }
        }.getOrNull()
    }

    Box(modifier = Modifier.size(size.dp)) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = record.name,
                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF1A1A2E), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text("?", color = Color(0xFF555555), fontSize = 18.sp)
            }
        }
        // Pity badge
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .background(Color(0xCCE87A2D), RoundedCornerShape(topStart = 4.dp))
                .padding(horizontal = 3.dp, vertical = 1.dp)
        ) {
            // pity shown as pull_number mod — approximated from order
            Text("${record.duplicateIdx + 1}", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun PullRow(record: RescueRecordEntity) {
    val borderColor = when (record.rarity) {
        5 -> Color(0xFFFFD700)
        4 -> Color(0xFFB39DDB)
        else -> Color.Transparent
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1A1A2E), RoundedCornerShape(8.dp))
            .border(
                width = if (record.rarity != null && record.rarity >= 4) 2.dp else 0.dp,
                color = borderColor,
                shape = RoundedCornerShape(topStart = 8.dp, bottomStart = 8.dp)
            )
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Roll number
        Text(
            "${record.pullNumber}",
            color = Color(0xFF555555), fontSize = 10.sp,
            modifier = Modifier.width(40.dp)
        )

        // Portrait thumbnail
        val context = LocalContext.current
        val bitmap = remember(record.resId) {
            runCatching {
                context.assets.open("faces/bookmark_face_character_map_${record.resId}.png")
                    .use { BitmapFactory.decodeStream(it) }
            }.getOrNull()
        }
        Box(modifier = Modifier.size(28.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFF111827))) {
            if (bitmap != null) {
                Image(bitmap.asImageBitmap(), record.name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            }
        }

        // Name + kind badge
        Column(modifier = Modifier.weight(1f)) {
            Text(record.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            val kindColor = if (record.type.startsWith("Partner")) Color(0xFF66BB6A) else Color(0xFFEF9A9A)
            val kindBg = if (record.type.startsWith("Partner")) Color(0xFF1A2A1A) else Color(0xFF2A1A1A)
            Text(
                record.type.removeSuffix("s"),
                color = kindColor, fontSize = 9.sp,
                modifier = Modifier
                    .background(kindBg, RoundedCornerShape(3.dp))
                    .padding(horizontal = 5.dp, vertical = 1.dp)
            )
        }

        // Pity (placeholder — real pity computed in export)
        val pityColor = if (record.rarity == 5) Color(0xFFFFD700) else Color(0xFFE87A2D)
        Text(
            "${record.duplicateIdx + 1}",
            color = pityColor, fontSize = 11.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.width(24.dp)
        )

        // Date
        val dateStr = remember(record.createAt) {
            runCatching {
                val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                val out = SimpleDateFormat("M/d HH:mm", Locale.getDefault())
                out.format(sdf.parse(record.createAt)!!)
            }.getOrDefault(record.createAt.take(10))
        }
        Text(dateStr, color = Color(0xFF555555), fontSize = 9.sp)
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, color = Color(0xFFE87A2D), fontSize = 10.sp, letterSpacing = 1.sp)
}

@Composable
private fun FilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        label,
        color = if (selected) Color(0xFFE87A2D) else Color(0xFF888888),
        fontSize = 10.sp,
        modifier = Modifier
            .background(
                if (selected) Color(0xFF1F1508) else Color(0xFF1A1A2E),
                RoundedCornerShape(10.dp)
            )
            .border(1.dp, if (selected) Color(0x55E87A2D) else Color(0xFF2a2a4a), RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 4.dp)
    )
}

@Composable
private fun ActionChip(label: String, color: Color, onClick: () -> Unit) {
    Text(
        label,
        color = color,
        fontSize = 9.sp,
        modifier = Modifier
            .background(color.copy(alpha = 0.1f), RoundedCornerShape(6.dp))
            .border(1.dp, color.copy(alpha = 0.3f), RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 4.dp)
    )
}
```

- [ ] **Step 2: Verify build compiles**

```bash
./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/HistoryActivity.kt
git commit -m "feat: add HistoryActivity with stats, 5★ grid, pull list, and cloud button"
```

---

## Task 5: Register HistoryActivity + Remove MainActivity Stub

**Files:**
- Modify: `android-app/app/src/main/AndroidManifest.xml`
- Modify: `android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/MainActivity.kt`

- [ ] **Step 1: Add HistoryActivity to AndroidManifest.xml**

Find the `<application>` block and add `HistoryActivity`:

```xml
<activity
    android:name=".ui.HistoryActivity"
    android:exported="false"
    android:theme="@style/Theme.AppCompat.DayNight.NoActionBar" />
```

- [ ] **Step 2: Remove the temporary HistoryActivity stub from MainActivity.kt**

Delete the stub class that was added in Plan B Task 3 Step 2:
```kotlin
// DELETE this block:
class HistoryActivity : ComponentActivity() {
    override fun onCreate(s: Bundle?) { super.onCreate(s); finish() }
}
```

- [ ] **Step 3: Verify build**

```bash
./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add android-app/app/src/main/AndroidManifest.xml \
        android-app/app/src/main/kotlin/com/hubczn/optimizer/ui/MainActivity.kt
git commit -m "feat: register HistoryActivity in manifest, remove stub"
```

---

## Verification

- [ ] **Run all tests**

```bash
./gradlew testDebugUnitTest
```
Expected: All tests pass including `HistoryViewModelTest`

- [ ] **Install and smoke test on device**

```bash
./gradlew installDebug
```

Manual test flow:
1. Open app → tap "📊 Ver Histórico" → HistoryActivity opens
2. Banner tabs: tap "Gacha General" → list filters to that banner
3. 5★ grid shows portrait images (not placeholders) for known characters
4. Tap "⬇ Export JSON" → file written, no crash
5. Tap "☁ Save to Cloud" → browser opens `hub-czn.lovable.app`
6. Filter "5★" → only gold-bordered rows visible
7. Filter "4★" → only purple-bordered rows visible
8. Filter "All" → all rows visible

- [ ] **Final commit — all 3 plans complete**

```bash
git log --oneline -20
```
Review that all feature commits from Plans A, B, C are present, then tag:
```bash
git tag v2.0.0-android
```
