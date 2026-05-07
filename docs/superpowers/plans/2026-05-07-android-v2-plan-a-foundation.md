# Android v2 — Plan A: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Room database, character lookup, and desktop-compatible JSON export to the CZN Scanner Android app.

**Architecture:** `ScanConfigStore` wraps SharedPreferences for all persisted settings. `CharacterRepository` loads a bundled `characters.json` asset (extracted from the desktop project) to resolve `name → {res_id, rarity, kind}`. `RescueRecordDao` stores OCR results with `duplicate_idx`-based deduplication. `JSONExporter` queries the DB and outputs the desktop-compatible format grouped by banner with computed `pity` and `pull_number`.

**Tech Stack:** Kotlin, Room 2.6.1 (KSP), kotlinx.serialization, Robolectric (existing), Android SharedPreferences, SAF (Android SDK)

**Spec:** `docs/superpowers/specs/2026-05-07-android-v2-design.md`

**Depends on:** Nothing — implement this plan first.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `android-app/gradle/libs.versions.toml` |
| Modify | `android-app/app/build.gradle.kts` |
| Modify | `android-app/build.gradle.kts` |
| Create | `scripts/extract_characters.py` |
| Create | `android-app/app/src/main/assets/characters.json` |
| Create | `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/ScanConfigStore.kt` |
| Create | `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/repository/CharacterRepository.kt` |
| Create | `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/RescueRecordEntity.kt` |
| Create | `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/RescueRecordDao.kt` |
| Create | `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/RescueRecordDatabase.kt` |
| Modify | `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/repository/JSONExporter.kt` |
| Modify | `android-app/app/src/main/kotlin/com/hubczn/optimizer/capture/CaptureService.kt` |
| Modify | `android-app/app/src/main/kotlin/com/hubczn/optimizer/logic/RescueRecordScanner.kt` |
| Create | `android-app/app/src/test/kotlin/com/hubczn/optimizer/data/local/ScanConfigStoreTest.kt` |
| Create | `android-app/app/src/test/kotlin/com/hubczn/optimizer/data/repository/CharacterRepositoryTest.kt` |
| Create | `android-app/app/src/test/kotlin/com/hubczn/optimizer/data/local/RescueRecordDaoTest.kt` |

---

## Task 1: Add KSP + Room to Gradle

**Files:**
- Modify: `android-app/gradle/libs.versions.toml`
- Modify: `android-app/build.gradle.kts`
- Modify: `android-app/app/build.gradle.kts`

- [ ] **Step 1: Add KSP and Room versions to libs.versions.toml**

Open `android-app/gradle/libs.versions.toml` and add the new entries:

```toml
[versions]
agp = "8.3.2"
kotlin = "2.0.0"
ksp = "2.0.0-1.0.21"
room = "2.6.1"
# ... existing versions unchanged ...

[libraries]
# ... existing libraries unchanged ...
androidx-room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
androidx-room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
androidx-room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }

[plugins]
# ... existing plugins unchanged ...
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
```

- [ ] **Step 2: Apply KSP plugin in root build.gradle.kts**

Open `android-app/build.gradle.kts`. It currently contains only `plugins {}` with `alias` entries. Add KSP:

```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
}
```

- [ ] **Step 3: Apply KSP and add Room dependencies in app/build.gradle.kts**

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

// ... android block unchanged ...

dependencies {
    // ... existing dependencies unchanged ...
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.room.runtime)
}
```

- [ ] **Step 4: Sync and verify build compiles**

```bash
cd android-app
./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add android-app/gradle/libs.versions.toml android-app/build.gradle.kts android-app/app/build.gradle.kts
git commit -m "build: add KSP and Room 2.6.1 dependencies"
```

---

## Task 2: Generate characters.json from Desktop Project

**Files:**
- Create: `scripts/extract_characters.py`
- Create: `android-app/app/src/main/assets/characters.json`

- [ ] **Step 1: Create extraction script**

Create `scripts/extract_characters.py` at the repo root (not inside android-app):

```python
#!/usr/bin/env python3
"""Extract character lookup table from desktop game_data into Android asset."""
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from game_data.characters import CHARACTERS
from game_data.partners import PARTNERS

lookup = {}

for res_id, data in CHARACTERS.items():
    name = data.get("name", "")
    if name:
        lookup[name] = {
            "res_id": res_id,
            "rarity": data.get("grade", 3),
            "kind": "Combatant"
        }

for res_id, data in PARTNERS.items():
    name = data.get("name", "")
    if name:
        lookup[name] = {
            "res_id": res_id,
            "rarity": data.get("grade", 3),
            "kind": "Partner"
        }

out_path = os.path.join(
    os.path.dirname(__file__), "..", "android-app", "app", "src", "main", "assets", "characters.json"
)
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(lookup, f, ensure_ascii=False, indent=2)

print(f"Written {len(lookup)} characters to {out_path}")
```

- [ ] **Step 2: Run the script from the repo root**

```bash
cd C:/Users/soste/Documents/Vribbels-CZN-Optimizer/.worktrees/android-ocr-scanner
python scripts/extract_characters.py
```
Expected: `Written N characters to android-app/app/src/main/assets/characters.json`

- [ ] **Step 3: Verify the output has the right shape**

```bash
python -c "
import json
data = json.load(open('android-app/app/src/main/assets/characters.json'))
print('Total:', len(data))
print('Sample:', list(data.items())[:3])
"
```
Expected: Entries like `('Akad', {'res_id': 20007, 'rarity': 4, 'kind': 'Partner'})`

- [ ] **Step 4: Commit**

```bash
git add scripts/extract_characters.py android-app/app/src/main/assets/characters.json
git commit -m "feat: add character lookup asset and extraction script"
```

---

## Task 3: ScanConfigStore

**Files:**
- Create: `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/ScanConfigStore.kt`
- Create: `android-app/app/src/test/kotlin/com/hubczn/optimizer/data/local/ScanConfigStoreTest.kt`

- [ ] **Step 1: Write failing tests**

Create `android-app/app/src/test/kotlin/com/hubczn/optimizer/data/local/ScanConfigStoreTest.kt`:

```kotlin
package com.hubczn.optimizer.data.local

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ScanConfigStoreTest {
    private lateinit var store: ScanConfigStore

    @Before
    fun setUp() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        store = ScanConfigStore(ctx)
    }

    @Test
    fun `calib coords default to null`() {
        assertNull(store.calibRescueX)
        assertNull(store.calibRescueY)
        assertNull(store.calibFragmentsX)
        assertNull(store.calibCombatantsX)
    }

    @Test
    fun `calib coords round-trip`() {
        store.calibRescueX = 123.5f
        store.calibRescueY = 456.0f
        assertEquals(123.5f, store.calibRescueX)
        assertEquals(456.0f, store.calibRescueY)
    }

    @Test
    fun `language override default null`() {
        assertNull(store.languageOverride)
    }

    @Test
    fun `language override round-trip`() {
        store.languageOverride = "pt"
        assertEquals("pt", store.languageOverride)
        store.languageOverride = null
        assertNull(store.languageOverride)
    }

    @Test
    fun `lastBannerIndex defaults to 0`() {
        assertEquals(0, store.lastBannerIndex)
    }

    @Test
    fun `lastBannerIndex round-trip`() {
        store.lastBannerIndex = 2
        assertEquals(2, store.lastBannerIndex)
    }
}
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd android-app
./gradlew testDebugUnitTest --tests "com.hubczn.optimizer.data.local.ScanConfigStoreTest"
```
Expected: FAILED — `ScanConfigStore` not found

- [ ] **Step 3: Implement ScanConfigStore**

Create `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/ScanConfigStore.kt`:

```kotlin
package com.hubczn.optimizer.data.local

import android.content.Context
import android.net.Uri

class ScanConfigStore(context: Context) {
    private val prefs = context.getSharedPreferences("czn_config", Context.MODE_PRIVATE)

    var calibRescueX: Float?
        get() = if (prefs.contains(KEY_CALIB_X_RESCUE)) prefs.getFloat(KEY_CALIB_X_RESCUE, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_X_RESCUE, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_X_RESCUE).apply()

    var calibRescueY: Float?
        get() = if (prefs.contains(KEY_CALIB_Y_RESCUE)) prefs.getFloat(KEY_CALIB_Y_RESCUE, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_Y_RESCUE, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_Y_RESCUE).apply()

    var calibFragmentsX: Float?
        get() = if (prefs.contains(KEY_CALIB_X_FRAG)) prefs.getFloat(KEY_CALIB_X_FRAG, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_X_FRAG, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_X_FRAG).apply()

    var calibFragmentsY: Float?
        get() = if (prefs.contains(KEY_CALIB_Y_FRAG)) prefs.getFloat(KEY_CALIB_Y_FRAG, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_Y_FRAG, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_Y_FRAG).apply()

    var calibCombatantsX: Float?
        get() = if (prefs.contains(KEY_CALIB_X_COMB)) prefs.getFloat(KEY_CALIB_X_COMB, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_X_COMB, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_X_COMB).apply()

    var calibCombatantsY: Float?
        get() = if (prefs.contains(KEY_CALIB_Y_COMB)) prefs.getFloat(KEY_CALIB_Y_COMB, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_Y_COMB, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_Y_COMB).apply()

    var outputFolderUri: Uri?
        get() = prefs.getString(KEY_OUTPUT_URI, null)?.let { Uri.parse(it) }
        set(v) = v?.let { prefs.edit().putString(KEY_OUTPUT_URI, it.toString()).apply() }
            ?: prefs.edit().remove(KEY_OUTPUT_URI).apply()

    var languageOverride: String?
        get() = prefs.getString(KEY_LANGUAGE, null)
        set(v) = v?.let { prefs.edit().putString(KEY_LANGUAGE, it).apply() }
            ?: prefs.edit().remove(KEY_LANGUAGE).apply()

    var lastBannerIndex: Int
        get() = prefs.getInt(KEY_BANNER_IDX, 0)
        set(v) = prefs.edit().putInt(KEY_BANNER_IDX, v).apply()

    companion object {
        private const val KEY_CALIB_X_RESCUE = "calib_x_rescue"
        private const val KEY_CALIB_Y_RESCUE = "calib_y_rescue"
        private const val KEY_CALIB_X_FRAG = "calib_x_fragments"
        private const val KEY_CALIB_Y_FRAG = "calib_y_fragments"
        private const val KEY_CALIB_X_COMB = "calib_x_combatants"
        private const val KEY_CALIB_Y_COMB = "calib_y_combatants"
        private const val KEY_OUTPUT_URI = "output_folder_uri"
        private const val KEY_LANGUAGE = "language_override"
        private const val KEY_BANNER_IDX = "last_banner_index"
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
./gradlew testDebugUnitTest --tests "com.hubczn.optimizer.data.local.ScanConfigStoreTest"
```
Expected: `BUILD SUCCESSFUL`, all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/ScanConfigStore.kt \
        android-app/app/src/test/kotlin/com/hubczn/optimizer/data/local/ScanConfigStoreTest.kt
git commit -m "feat: add ScanConfigStore for persistent app configuration"
```

---

## Task 4: CharacterRepository

**Files:**
- Create: `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/repository/CharacterRepository.kt`
- Create: `android-app/app/src/test/kotlin/com/hubczn/optimizer/data/repository/CharacterRepositoryTest.kt`

- [ ] **Step 1: Write failing tests**

Create `android-app/app/src/test/kotlin/com/hubczn/optimizer/data/repository/CharacterRepositoryTest.kt`:

```kotlin
package com.hubczn.optimizer.data.repository

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class CharacterRepositoryTest {
    private lateinit var repo: CharacterRepository

    @Before
    fun setUp() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        repo = CharacterRepository(ctx)
    }

    @Test
    fun `lookup returns null for unknown name`() {
        assertNull(repo.lookup("NonExistentCharXYZ"))
    }

    @Test
    fun `lookup returns data for known character`() {
        // characters.json must have at least one entry — any real name will do
        // This test validates the JSON loads and parses correctly
        val allNames = repo.allNames()
        assertTrue("characters.json should have entries", allNames.isNotEmpty())
        val firstName = allNames.first()
        val info = repo.lookup(firstName)
        assertNotNull(info)
        assertTrue(info!!.resId > 0)
        assertTrue(info.rarity in 3..5)
        assertTrue(info.kind in listOf("Combatant", "Partner"))
    }

    @Test
    fun `imageUrl is correct pattern`() {
        val allNames = repo.allNames()
        val info = repo.lookup(allNames.first())!!
        assertEquals(
            "/assets/game/faces/bookmark_face_character_map_${info.resId}.png",
            info.imageUrl
        )
    }
}
```

- [ ] **Step 2: Run to verify tests fail**

```bash
./gradlew testDebugUnitTest --tests "com.hubczn.optimizer.data.repository.CharacterRepositoryTest"
```
Expected: FAILED — `CharacterRepository` not found

- [ ] **Step 3: Implement CharacterRepository**

Create `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/repository/CharacterRepository.kt`:

```kotlin
package com.hubczn.optimizer.data.repository

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

data class CharInfo(
    val resId: Int,
    val rarity: Int,
    val kind: String
) {
    val imageUrl: String get() = "/assets/game/faces/bookmark_face_character_map_$resId.png"
}

class CharacterRepository(context: Context) {
    private val lookup: Map<String, CharInfo>

    init {
        val raw = context.assets.open("characters.json").bufferedReader().readText()
        val json = Json.parseToJsonElement(raw).jsonObject
        lookup = json.entries.associate { (name, value) ->
            val obj = value.jsonObject
            name to CharInfo(
                resId = obj["res_id"]!!.jsonPrimitive.int,
                rarity = obj["rarity"]!!.jsonPrimitive.int,
                kind = obj["kind"]!!.jsonPrimitive.content
            )
        }
    }

    fun lookup(name: String): CharInfo? = lookup[name]

    fun allNames(): List<String> = lookup.keys.toList()
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
./gradlew testDebugUnitTest --tests "com.hubczn.optimizer.data.repository.CharacterRepositoryTest"
```
Expected: `BUILD SUCCESSFUL`, all 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add android-app/app/src/main/kotlin/com/hubczn/optimizer/data/repository/CharacterRepository.kt \
        android-app/app/src/test/kotlin/com/hubczn/optimizer/data/repository/CharacterRepositoryTest.kt
git commit -m "feat: add CharacterRepository loading characters.json asset"
```

---

## Task 5: Room Entity + DAO

**Files:**
- Create: `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/RescueRecordEntity.kt`
- Create: `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/RescueRecordDao.kt`
- Create: `android-app/app/src/test/kotlin/com/hubczn/optimizer/data/local/RescueRecordDaoTest.kt`

- [ ] **Step 1: Write failing tests**

Create `android-app/app/src/test/kotlin/com/hubczn/optimizer/data/local/RescueRecordDaoTest.kt`:

```kotlin
package com.hubczn.optimizer.data.local

import android.app.Application
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RescueRecordDaoTest {
    private lateinit var db: RescueRecordDatabase
    private lateinit var dao: RescueRecordDao

    @Before
    fun setUp() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        db = Room.inMemoryDatabaseBuilder(ctx, RescueRecordDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        dao = db.rescueRecordDao()
    }

    @After
    fun tearDown() { db.close() }

    private fun record(
        name: String = "Akad",
        bannerName: String = "Seasonal Combatant Rescue Rate-Up",
        createAt: String = "2026-04-29 08:16:56",
        duplicateIdx: Int = 0,
        pullNumber: Long = 1L
    ) = RescueRecordEntity(
        bannerName = bannerName,
        name = name,
        type = "Partners",
        createAt = createAt,
        rescueType = "Seasonal Combatant Rescue Rate-Up",
        isFeatured = false,
        duplicateIdx = duplicateIdx,
        resId = 20007,
        rarity = 4,
        pullNumber = pullNumber
    )

    @Test
    fun `insert and retrieve by banner`() = runTest {
        dao.upsert(record())
        val results = dao.getByBanner("Seasonal Combatant Rescue Rate-Up")
        assertEquals(1, results.size)
        assertEquals("Akad", results[0].name)
    }

    @Test
    fun `duplicate insert is ignored`() = runTest {
        dao.upsert(record())
        dao.upsert(record()) // same unique key
        val results = dao.getByBanner("Seasonal Combatant Rescue Rate-Up")
        assertEquals(1, results.size)
    }

    @Test
    fun `same name same time different duplicateIdx are distinct`() = runTest {
        dao.upsert(record(duplicateIdx = 0, pullNumber = 1))
        dao.upsert(record(duplicateIdx = 1, pullNumber = 2))
        val results = dao.getByBanner("Seasonal Combatant Rescue Rate-Up")
        assertEquals(2, results.size)
    }

    @Test
    fun `countDuplicates returns correct count`() = runTest {
        dao.upsert(record(duplicateIdx = 0))
        dao.upsert(record(duplicateIdx = 1))
        val count = dao.countDuplicates(
            bannerName = "Seasonal Combatant Rescue Rate-Up",
            name = "Akad",
            type = "Partners",
            createAt = "2026-04-29 08:16:56",
            rescueType = "Seasonal Combatant Rescue Rate-Up",
            isFeatured = false
        )
        assertEquals(2, count)
    }

    @Test
    fun `maxPullNumber returns 0 when empty`() = runTest {
        assertEquals(0L, dao.maxPullNumber())
    }

    @Test
    fun `maxPullNumber returns highest value`() = runTest {
        dao.upsert(record(pullNumber = 10L))
        dao.upsert(record(name = "Yuri", pullNumber = 20L))
        assertEquals(20L, dao.maxPullNumber())
    }

    @Test
    fun `getAllOrderedByPullNumber returns ascending order`() = runTest {
        dao.upsert(record(name = "Yuri", pullNumber = 2L))
        dao.upsert(record(name = "Akad", pullNumber = 1L))
        val all = dao.getAllOrderedByPullNumber()
        assertEquals("Akad", all[0].name)
        assertEquals("Yuri", all[1].name)
    }
}
```

- [ ] **Step 2: Run to verify tests fail**

```bash
./gradlew testDebugUnitTest --tests "com.hubczn.optimizer.data.local.RescueRecordDaoTest"
```
Expected: FAILED — entity/DAO not found

- [ ] **Step 3: Create RescueRecordEntity**

Create `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/RescueRecordEntity.kt`:

```kotlin
package com.hubczn.optimizer.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "rescue_records",
    indices = [
        Index(
            value = ["bannerName", "name", "type", "createAt", "rescueType", "isFeatured", "duplicateIdx"],
            unique = true
        )
    ]
)
data class RescueRecordEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val bannerName: String,
    val name: String,
    val type: String,
    val createAt: String,
    val rescueType: String,
    val isFeatured: Boolean,
    val duplicateIdx: Int,
    val resId: Int?,
    val rarity: Int?,
    val pullNumber: Long
)
```

- [ ] **Step 4: Create RescueRecordDao**

Create `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/RescueRecordDao.kt`:

```kotlin
package com.hubczn.optimizer.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface RescueRecordDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun upsert(record: RescueRecordEntity)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun upsertAll(records: List<RescueRecordEntity>)

    @Query("SELECT * FROM rescue_records WHERE bannerName = :bannerName ORDER BY pullNumber DESC")
    suspend fun getByBanner(bannerName: String): List<RescueRecordEntity>

    @Query("SELECT * FROM rescue_records ORDER BY pullNumber ASC")
    suspend fun getAllOrderedByPullNumber(): List<RescueRecordEntity>

    @Query("""
        SELECT COUNT(*) FROM rescue_records
        WHERE bannerName = :bannerName AND name = :name AND type = :type
          AND createAt = :createAt AND rescueType = :rescueType AND isFeatured = :isFeatured
    """)
    suspend fun countDuplicates(
        bannerName: String, name: String, type: String,
        createAt: String, rescueType: String, isFeatured: Boolean
    ): Int

    @Query("SELECT COALESCE(MAX(pullNumber), 0) FROM rescue_records")
    suspend fun maxPullNumber(): Long

    @Query("SELECT DISTINCT bannerName FROM rescue_records")
    suspend fun allBannerNames(): List<String>
}
```

- [ ] **Step 5: Create RescueRecordDatabase**

Create `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/RescueRecordDatabase.kt`:

```kotlin
package com.hubczn.optimizer.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [RescueRecordEntity::class], version = 1, exportSchema = false)
abstract class RescueRecordDatabase : RoomDatabase() {
    abstract fun rescueRecordDao(): RescueRecordDao

    companion object {
        @Volatile private var INSTANCE: RescueRecordDatabase? = null

        fun getInstance(context: Context): RescueRecordDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    RescueRecordDatabase::class.java,
                    "rescue_records.db"
                ).build().also { INSTANCE = it }
            }
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
./gradlew testDebugUnitTest --tests "com.hubczn.optimizer.data.local.RescueRecordDaoTest"
```
Expected: `BUILD SUCCESSFUL`, all 7 tests pass

- [ ] **Step 7: Commit**

```bash
git add android-app/app/src/main/kotlin/com/hubczn/optimizer/data/local/ \
        android-app/app/src/test/kotlin/com/hubczn/optimizer/data/local/RescueRecordDaoTest.kt
git commit -m "feat: add Room DB with RescueRecordEntity, DAO, and deduplication"
```

---

## Task 6: Update JSONExporter — Desktop-Compatible Format

**Files:**
- Modify: `android-app/app/src/main/kotlin/com/hubczn/optimizer/data/repository/JSONExporter.kt`

The new `exportRescueRecords()` queries Room, computes `pity` per banner, and outputs the desktop format. The old path-based approach is replaced by SAF URI with Downloads fallback.

- [ ] **Step 1: Replace JSONExporter.kt**

```kotlin
package com.hubczn.optimizer.data.repository

import android.content.Context
import android.net.Uri
import android.os.Environment
import com.hubczn.optimizer.data.local.RescueRecordDao
import com.hubczn.optimizer.data.local.RescueRecordEntity
import com.hubczn.optimizer.model.Combatant
import com.hubczn.optimizer.model.MemoryFragment
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.io.File
import java.io.OutputStream
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

class JSONExporter(
    private val context: Context,
    private val dao: RescueRecordDao,
    private val outputFolderUri: Uri? = null
) {
    private val json = Json { prettyPrint = true; encodeDefaults = true }
    private val tsFormat = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")
    private val isoFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss")
    private val createAtFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

    private fun openOutputStream(filename: String): Pair<OutputStream, String> {
        if (outputFolderUri != null) {
            val docUri = androidx.documentfile.provider.DocumentFile
                .fromTreeUri(context, outputFolderUri)!!
                .createFile("application/json", filename)!!
                .uri
            return context.contentResolver.openOutputStream(docUri)!! to filename
        }
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "CZN-Scanner"
        ).also { it.mkdirs() }
        val file = File(dir, filename)
        return file.outputStream() to file.name
    }

    /** Export all rescue records from DB in desktop-compatible format. */
    suspend fun exportRescueRecordsFromDb(): String {
        val now = LocalDateTime.now()
        val filename = "rescue_records_android_${now.format(tsFormat)}.json"
        val allRecords = dao.getAllOrderedByPullNumber()
        val grouped = allRecords.groupBy { it.bannerName }

        val payload = buildJsonArray {
            for ((bannerName, records) in grouped) {
                add(buildJsonObject {
                    put("banner_name", bannerName)
                    putJsonArray("pulls") {
                        val pityCounters = mutableMapOf<String, Int>()
                        for (r in records) {
                            val key = r.bannerName
                            val counter = (pityCounters[key] ?: 0) + 1
                            pityCounters[key] = if ((r.rarity ?: 0) >= 5) 0 else counter
                            add(buildJsonObject {
                                put("pull_number", r.pullNumber)
                                put("res_id", r.resId ?: 0)
                                put("name", r.name)
                                put("rarity", r.rarity ?: 3)
                                put("kind", r.type.removeSuffix("s"))
                                put("image_url", "/assets/game/faces/bookmark_face_character_map_${r.resId}.png")
                                put("pity", counter)
                                put("is_featured", r.isFeatured)
                                put("timestamp", parseTimestamp(r.createAt))
                            })
                        }
                    }
                })
            }
        }

        val (out, name) = openOutputStream(filename)
        out.use { it.write(json.encodeToString(payload).toByteArray()) }
        return name
    }

    private fun parseTimestamp(createAt: String): Long = try {
        LocalDateTime.parse(createAt, createAtFormat).toEpochSecond(ZoneOffset.UTC)
    } catch (e: Exception) {
        0L
    }

    fun exportFragments(fragments: List<MemoryFragment>): File {
        val now = LocalDateTime.now()
        val filename = "memory_fragments_android_${now.format(tsFormat)}.json"
        val payload = buildJsonObject {
            put("capture_time", now.format(isoFormat))
            put("source", "android_ocr")
            putJsonObject("inventory") { put("piece_items", json.encodeToJsonElement(fragments)) }
            putJsonObject("characters") {
                putJsonArray("characters") {}
                putJsonObject("user") { put("source", "android_ocr") }
            }
            put("detected_region", "global")
        }
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "CZN-Scanner"
        ).also { it.mkdirs() }
        return File(dir, filename).also { it.writeText(json.encodeToString(payload)) }
    }

    fun exportCombatants(combatants: List<Combatant>): File {
        val now = LocalDateTime.now()
        val filename = "combatants_android_${now.format(tsFormat)}.json"
        val payload = buildJsonObject {
            put("capture_time", now.format(isoFormat))
            put("source", "android_ocr")
            put("combatants", json.encodeToJsonElement(combatants))
        }
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "CZN-Scanner"
        ).also { it.mkdirs() }
        return File(dir, filename).also { it.writeText(json.encodeToString(payload)) }
    }
}
```

- [ ] **Step 2: Add `androidx.documentfile` dependency**

In `android-app/gradle/libs.versions.toml` add:
```toml
[libraries]
# existing entries...
androidx-documentfile = { group = "androidx.documentfile", name = "documentfile", version = "1.0.1" }
```

In `android-app/app/build.gradle.kts` add:
```kotlin
implementation(libs.androidx.documentfile)
```

- [ ] **Step 3: Verify build compiles**

```bash
./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add android-app/app/src/main/kotlin/com/hubczn/optimizer/data/repository/JSONExporter.kt \
        android-app/gradle/libs.versions.toml \
        android-app/app/build.gradle.kts
git commit -m "feat: update JSONExporter to desktop-compatible format with SAF support"
```

---

## Task 7: Update CaptureService — Use ScanConfigStore + DB Upsert

**Files:**
- Modify: `android-app/app/src/main/kotlin/com/hubczn/optimizer/capture/CaptureService.kt`
- Modify: `android-app/app/src/main/kotlin/com/hubczn/optimizer/logic/RescueRecordScanner.kt`

- [ ] **Step 1: Add pageLimit + selectedBanner params to RescueRecordScanner**

Replace `scan()` signature and loop in `RescueRecordScanner.kt`:

```kotlin
class RescueRecordScanner(
    private val screenshotManager: ScreenshotManager,
    private val ocrEngine: MLKitOCREngine,
    private val gestures: GestureDispatcher,
    private val selectedBanner: String = "Seasonal Combatant Rescue Rate-Up",
    private val pageLimit: Int? = null,
    private val onProgress: (String) -> Unit = {}
) {
    private val allRecords = mutableListOf<RescueRecord>()

    suspend fun scan(): List<RescueRecord> {
        allRecords.clear()
        var previousPageRecords: List<RescueRecord>? = null
        var page = 1

        while (true) {
            if (pageLimit != null && page > pageLimit) {
                onProgress("Page limit ($pageLimit) reached.")
                break
            }
            onProgress("Scanning page $page...")
            val bitmap = screenshotManager.capture() ?: break
            val blocks = ocrEngine.recognizeBlocks(bitmap)

            val headerY = findHeaderY(blocks)
            val records = RescueRecordParser.parseTableRows(blocks, selectedBanner, headerY)

            onProgress("Page $page: ${records.size} rows. Texts: ${blocks.take(6).map { it.text }}")

            if (records.isEmpty() || records == previousPageRecords) break
            allRecords.addAll(records)
            previousPageRecords = records

            val nextCoords = findNextButtonCoords(blocks, bitmap.width, bitmap.height)
            if (nextCoords == null) {
                val allTexts = blocks.map { "'${it.text}'" }.joinToString(" | ")
                onProgress("No next btn. All texts: $allTexts")
                break
            }

            val (cx, cy) = nextCoords
            onProgress("Tapping next at (${"%.0f".format(cx)}, ${"%.0f".format(cy)})")
            gestures.tap(cx, cy)

            val currentPageNum = extractPageNumber(blocks, bitmap.width, bitmap.height)
            onProgress("Waiting for page ${page + 1} to load...")
            val loaded = waitForPageChange(currentPageNum, timeoutMs = 10_000L)
            if (!loaded) {
                onProgress("Timeout waiting for page ${page + 1}. Stopping.")
                break
            }
            page++
        }

        onProgress("Done: ${allRecords.size} records")
        return RescueRecordParser.deduplicate(allRecords)
    }

    // findNextButtonCoords now reads from ScanConfigStore via companion — kept for now
    // Plans B will wire ScanConfigStore directly into the overlay calibration flow
    private fun findNextButtonCoords(blocks: List<OcrBlock>, screenWidth: Int, screenHeight: Int): Pair<Float, Float>? {
        val calX = CaptureService.calibratedNextX
        val calY = CaptureService.calibratedNextY
        if (calX != null && calY != null) return calX to calY

        val nextChars = setOf(">", "›", "»", "▶", "→", ">>", "next", "Next")
        val textBlock = blocks.filter { it.text.trim() in nextChars }.maxByOrNull { it.bounds.left }
        if (textBlock != null) return textBlock.bounds.exactCenterX() to textBlock.bounds.exactCenterY()

        val bottomThird = screenHeight * 2 / 3
        val pageNumBlock = blocks
            .filter { it.bounds.top > bottomThird && it.text.trim().matches(Regex("\\d{1,3}")) }
            .minByOrNull { Math.abs(it.bounds.exactCenterX() - screenWidth / 2f) }

        if (pageNumBlock != null) {
            val slotWidth = pageNumBlock.bounds.height() * 2.8f
            return pageNumBlock.bounds.exactCenterX() + slotWidth to pageNumBlock.bounds.exactCenterY()
        }
        return null
    }

    // ... extractPageNumber, waitForPageChange, extractBannerName, findHeaderY unchanged ...
}
```

- [ ] **Step 2: Update CaptureService.startScan to use ScanConfigStore + DB**

In `CaptureService.kt`, add `configStore`, `charRepo`, and `db` as lazy properties, and update `startScan`:

```kotlin
class CaptureService : Service() {
    // ... existing fields ...
    private val configStore by lazy { ScanConfigStore(this) }
    private val charRepo by lazy { CharacterRepository(this) }
    private val db by lazy { RescueRecordDatabase.getInstance(this) }

    // Add to startScan, RESCUE_RECORDS branch:
    ScanType.RESCUE_RECORDS -> {
        val bannerName = BANNER_NAMES[configStore.lastBannerIndex]
        val pageLimit = null // will be wired in Plan B via ScanOptionsOverlay
        val records = RescueRecordScanner(sm, ocr, gestures, bannerName, pageLimit) {
            notifyStatus(it)
        }.scan()

        // Upsert to DB
        val maxPull = db.rescueRecordDao().maxPullNumber()
        val newRecords = records.filter { r ->
            // Only records not in DB (by checking countDuplicates)
            true // deduplication handled by Room IGNORE
        }
        // Sort by createAt asc for pull_number assignment
        val sorted = newRecords.sortedWith(compareBy({ it.createAt }, { newRecords.indexOf(it) }))
        val entities = sorted.mapIndexed { idx, r ->
            val info = charRepo.lookup(r.name)
            val dupIdx = db.rescueRecordDao().countDuplicates(
                r.bannerName, r.name, r.type, r.createAt, r.rescueType, r.isFeatured
            )
            RescueRecordEntity(
                bannerName = r.bannerName,
                name = r.name,
                type = r.type,
                createAt = r.createAt,
                rescueType = r.rescueType,
                isFeatured = r.isFeatured,
                duplicateIdx = dupIdx,
                resId = info?.resId,
                rarity = info?.rarity,
                pullNumber = maxPull + idx + 1
            )
        }
        db.rescueRecordDao().upsertAll(entities)

        val exporter = JSONExporter(this, db.rescueRecordDao(), configStore.outputFolderUri)
        val filename = exporter.exportRescueRecordsFromDb()
        notifyStatus("Exported to $filename")
    }
```

Add the banner names constant to `CaptureService.companion`:
```kotlin
companion object {
    // ... existing constants ...
    val BANNER_NAMES = listOf(
        "Seasonal Combatant Rescue Rate-Up",
        "Gacha General",
        "Gacha Pickup Supporter"
    )
}
```

- [ ] **Step 3: Add required imports to CaptureService.kt**

```kotlin
import com.hubczn.optimizer.data.local.RescueRecordDatabase
import com.hubczn.optimizer.data.local.RescueRecordEntity
import com.hubczn.optimizer.data.local.ScanConfigStore
import com.hubczn.optimizer.data.repository.CharacterRepository
```

- [ ] **Step 4: Verify build compiles**

```bash
./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add android-app/app/src/main/kotlin/com/hubczn/optimizer/capture/CaptureService.kt \
        android-app/app/src/main/kotlin/com/hubczn/optimizer/logic/RescueRecordScanner.kt
git commit -m "feat: wire ScanConfigStore + Room DB upsert into rescue scan flow"
```

---

## Verification

- [ ] **Run all unit tests**

```bash
./gradlew testDebugUnitTest
```
Expected: All tests pass, `BUILD SUCCESSFUL`

- [ ] **Build release APK**

```bash
./gradlew assembleDebug
```
Expected: `BUILD SUCCESSFUL`, APK at `app/build/outputs/apk/debug/app-debug.apk`
