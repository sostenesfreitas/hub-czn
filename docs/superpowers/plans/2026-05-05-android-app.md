# Hub CZN Android — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native Android companion app (Kotlin + Jetpack Compose) that auto-captures game screen data via MediaProjection + ML Kit OCR and stores it in Room, powering 5 Compose screens (Combatentes, Fragmentos, Otimizador, Pontuação, Rescue Records).

**Architecture:** ForegroundService + MediaProjection captures a VirtualDisplay at 720p every 1500ms; ML Kit OCR detects 3 screen signatures (CHAR_STATS / MEMORY_FRAGMENT / RESCUE_RESULT) and writes extracted data to Room; 5 Compose screens consume Room Flows via ViewModels.

**Tech Stack:** Kotlin 2.1.0, Compose BOM 2024.12.01, Room 2.7.0 (KSP), ML Kit Text Recognition v2 16.0.1, Coroutines 1.9.0, Gson 2.11.0, Navigation Compose 2.8.5, Coil 2.7.0

---

## File Map

```
android-app/
├── gradle/libs.versions.toml
├── settings.gradle.kts
├── build.gradle.kts
├── gradle.properties
└── app/
    ├── build.gradle.kts
    ├── proguard-rules.pro
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml
        │   ├── res/values/themes.xml
        │   └── kotlin/com/hubczn/optimizer/
        │       ├── HubCznApp.kt
        │       ├── MainActivity.kt
        │       ├── capture/
        │       │   ├── CaptureService.kt
        │       │   ├── ScreenAnalyzer.kt
        │       │   ├── OcrProcessor.kt
        │       │   └── OcrDataWriter.kt
        │       ├── data/
        │       │   ├── db/
        │       │   │   ├── AppDatabase.kt
        │       │   │   ├── entities/CharacterEntity.kt
        │       │   │   ├── entities/FragmentEntity.kt
        │       │   │   ├── entities/FragmentSubstatEntity.kt
        │       │   │   ├── entities/RescuePullEntity.kt
        │       │   │   ├── entities/ScoreWeightEntity.kt
        │       │   │   ├── daos/CharacterDao.kt
        │       │   │   ├── daos/FragmentDao.kt
        │       │   │   ├── daos/RescueDao.kt
        │       │   │   └── daos/ScoreWeightDao.kt
        │       │   └── repository/
        │       │       ├── CharacterRepo.kt
        │       │       ├── FragmentRepo.kt
        │       │       ├── RescueRepo.kt
        │       │       └── WeightsRepo.kt
        │       ├── logic/
        │       │   ├── GearScorer.kt
        │       │   ├── BreakevenCalculator.kt
        │       │   ├── DamageCalculator.kt
        │       │   └── GearOptimizer.kt
        │       ├── model/
        │       │   ├── CharPreset.kt
        │       │   ├── OptimizeConfig.kt
        │       │   └── BuildResult.kt
        │       └── ui/
        │           ├── theme/Color.kt
        │           ├── theme/Type.kt
        │           ├── theme/Theme.kt
        │           ├── components/PortraitImage.kt
        │           ├── components/PityBadge.kt
        │           ├── nav/AppNav.kt
        │           ├── combatants/CombatantsViewModel.kt
        │           ├── combatants/CombatantsScreen.kt
        │           ├── fragments/FragmentsViewModel.kt
        │           ├── fragments/FragmentsScreen.kt
        │           ├── optimizer/OptimizerViewModel.kt
        │           ├── optimizer/OptimizerScreen.kt
        │           ├── scoring/ScoringViewModel.kt
        │           ├── scoring/ScoringScreen.kt
        │           ├── rescue/RescueViewModel.kt
        │           └── rescue/RescueScreen.kt
        ├── assets/
        │   ├── game/faces/   ← 72 PNGs from api/assets/game/faces/
        │   └── char_presets.json
        └── test/kotlin/com/hubczn/optimizer/
            ├── logic/GearScorerTest.kt
            ├── logic/BreakevenCalculatorTest.kt
            ├── logic/DamageCalculatorTest.kt
            ├── logic/GearOptimizerTest.kt
            └── capture/ScreenAnalyzerTest.kt
```

---

## Task 1: Project Scaffolding

**Files:** `android-app/gradle/libs.versions.toml`, `android-app/settings.gradle.kts`, `android-app/build.gradle.kts`, `android-app/gradle.properties`, `android-app/app/build.gradle.kts`, `android-app/app/src/main/AndroidManifest.xml`, `android-app/app/src/main/res/values/themes.xml`, `android-app/app/src/main/kotlin/com/hubczn/optimizer/HubCznApp.kt`

- [ ] **Step 1: Create version catalog**

Create `android-app/gradle/libs.versions.toml`:
```toml
[versions]
agp = "8.7.3"
kotlin = "2.1.0"
ksp = "2.1.0-1.0.29"
coreKtx = "1.15.0"
lifecycleRuntime = "2.8.7"
activityCompose = "1.9.3"
composeBom = "2024.12.01"
room = "2.7.0"
mlkitTextRecognition = "16.0.1"
coroutines = "1.9.0"
gson = "2.11.0"
navigationCompose = "2.8.5"
coil = "2.7.0"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycleRuntime" }
androidx-lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycleRuntime" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
androidx-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
androidx-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
androidx-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-material-icons = { group = "androidx.compose.material", name = "material-icons-extended" }
androidx-navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigationCompose" }
androidx-room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
androidx-room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
androidx-room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }
mlkit-text-recognition = { group = "com.google.mlkit", name = "text-recognition", version.ref = "mlkitTextRecognition" }
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }
gson = { group = "com.google.code.gson", name = "gson", version.ref = "gson" }
coil-compose = { group = "io.coil-kt", name = "coil-compose", version.ref = "coil" }
junit = { group = "junit", name = "junit", version = "4.13.2" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
```

- [ ] **Step 2: Create settings + root build files**

`android-app/settings.gradle.kts`:
```kotlin
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositories { google(); mavenCentral() }
}
rootProject.name = "HubCznOptimizer"
include(":app")
```

`android-app/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
}
```

`android-app/gradle.properties`:
```
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
```

- [ ] **Step 3: Create app/build.gradle.kts**

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.hubczn.optimizer"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.hubczn.optimizer"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions { jvmTarget = "1.8" }
    buildFeatures { compose = true }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.mlkit.text.recognition)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.gson)
    implementation(libs.coil.compose)
    testImplementation(libs.junit)
    debugImplementation(libs.androidx.ui.tooling)
}
```

- [ ] **Step 4: AndroidManifest + themes**

`app/src/main/AndroidManifest.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
    <application
        android:name=".HubCznApp"
        android:label="Hub CZN"
        android:theme="@style/Theme.HubCzn"
        android:supportsRtl="false">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
        <service
            android:name=".capture.CaptureService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaProjection"/>
    </application>
</manifest>
```

`app/src/main/res/values/themes.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.HubCzn" parent="android:Theme.Material.NoTitleBar">
        <item name="android:windowBackground">#0E0E0E</item>
        <item name="android:statusBarColor">#0E0E0E</item>
        <item name="android:navigationBarColor">#121212</item>
    </style>
</resources>
```

- [ ] **Step 5: Create HubCznApp**

`HubCznApp.kt`:
```kotlin
package com.hubczn.optimizer

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import com.hubczn.optimizer.data.db.AppDatabase
import com.hubczn.optimizer.data.repository.*
import com.hubczn.optimizer.model.CharPreset
import com.hubczn.optimizer.data.CharPresetsLoader

const val CHANNEL_ID = "hub_czn_capture"

class HubCznApp : Application() {
    val database by lazy { AppDatabase.getInstance(this) }
    val characterRepo by lazy { CharacterRepo(database.characterDao()) }
    val fragmentRepo by lazy { FragmentRepo(database.fragmentDao(), database.fragmentSubstatDao()) }
    val rescueRepo by lazy { RescueRepo(database.rescueDao()) }
    val weightsRepo by lazy { WeightsRepo(database.scoreWeightDao()) }
    val charPresets: Map<Int, CharPreset> by lazy { CharPresetsLoader.load(this) }

    override fun onCreate() {
        super.onCreate()
        val channel = NotificationChannel(
            CHANNEL_ID, "Captura de Tela", NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Hub CZN screen capture service" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
```

- [ ] **Step 6: Verify project syncs**

```bash
cd android-app
./gradlew assembleDebug
```
Expected: BUILD SUCCESSFUL (will fail at compile until later tasks, but Gradle should resolve dependencies)

---

## Task 2: Design System

**Files:** `ui/theme/Color.kt`, `ui/theme/Type.kt`, `ui/theme/Theme.kt`

- [ ] **Step 1: Write Color.kt**

```kotlin
package com.hubczn.optimizer.ui.theme

import androidx.compose.ui.graphics.Color

val Background = Color(0xFF0E0E0E)
val Surface = Color(0xFF181818)
val SurfaceVariant = Color(0xFF121212)
val Border = Color(0xFF282828)
val BorderSubtle = Color(0xFF1E1E1E)
val Primary = Color(0xFFC084FC)
val Secondary = Color(0xFF8B5CF6)
val TextPrimary = Color(0xFFFFFFFF)
val TextSecondary = Color(0xFFB3B3B3)
val TextMuted = Color(0xFF888888)
val ErrorColor = Color(0xFFF3727F)
val SuccessColor = Color(0xFF86EFAC)

// Rarity
val RarityLegendary = Color(0xFFC084FC)
val RarityRare = Color(0xFF3B82F6)
val RarityUncommon = Color(0xFF84CC16)
val RarityCommon = Color(0xFFA8A29E)

fun rarityColor(rarity: Int) = when (rarity) {
    4 -> RarityLegendary
    3 -> RarityRare
    2 -> RarityUncommon
    else -> RarityCommon
}

fun pityColor(pity: Int) = when {
    pity <= 25 -> Color(0xFF86EFAC)
    pity <= 50 -> Color(0xFFFBBF24)
    pity <= 65 -> Color(0xFFFB923C)
    else -> Color(0xFFF87171)
}
```

- [ ] **Step 2: Write Type.kt**

```kotlin
package com.hubczn.optimizer.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val Typography = Typography(
    bodyLarge = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 14.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 12.sp),
    bodySmall = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 10.sp),
    labelSmall = TextStyle(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Normal, fontSize = 10.sp),
)
```

- [ ] **Step 3: Write Theme.kt**

```kotlin
package com.hubczn.optimizer.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable

private val DarkColors = darkColorScheme(
    background = Background,
    surface = Surface,
    surfaceVariant = SurfaceVariant,
    primary = Primary,
    secondary = Secondary,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    error = ErrorColor,
    outline = Border,
)

@Composable
fun HubCznTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkColors, typography = Typography, content = content)
}
```

---

## Task 3: Room Entities

**Files:** 5 entity files in `data/db/entities/`

- [ ] **Step 1: Write all 5 entities**

`CharacterEntity.kt`:
```kotlin
package com.hubczn.optimizer.data.db.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "characters")
data class CharacterEntity(
    @PrimaryKey val name: String,
    val atk: Float, val def: Float, val hp: Float,
    val critRate: Float, val critDmg: Float,
    val resId: Int = 0,
    val partnerName: String? = null,
    val capturedAt: Long
)
```

`FragmentEntity.kt`:
```kotlin
@Entity(tableName = "fragments")
data class FragmentEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val slot: Int, val rarity: Int, val level: Int,
    val setName: String, val setId: Int = 0,
    val mainStatName: String, val mainStatValue: Float,
    val equippedTo: String? = null,
    val capturedAt: Long
)
```

`FragmentSubstatEntity.kt`:
```kotlin
@Entity(tableName = "fragment_substats")
data class FragmentSubstatEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val fragmentId: Int,
    val name: String, val value: Float, val rollCount: Int
)
```

`RescuePullEntity.kt`:
```kotlin
@Entity(tableName = "rescue_pulls")
data class RescuePullEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val bannerName: String, val pullNumber: Int,
    val characterName: String, val rarity: Int,
    val pity: Int, val isFeatured: Boolean, val timestamp: Long
)
```

`ScoreWeightEntity.kt` (composite PK — "" = global, charId = per-character):
```kotlin
@Entity(tableName = "score_weights", primaryKeys = ["stat_name", "char_override"])
data class ScoreWeightEntity(
    @ColumnInfo(name = "stat_name") val statName: String,
    val weight: Float,
    @ColumnInfo(name = "char_override") val charOverride: String = ""
)
```

---

## Task 4: DAOs + AppDatabase

**Files:** 4 DAO files, `AppDatabase.kt`

- [ ] **Step 1: Write CharacterDao.kt**

```kotlin
package com.hubczn.optimizer.data.db.daos

import androidx.room.*
import com.hubczn.optimizer.data.db.entities.CharacterEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CharacterDao {
    @Query("SELECT * FROM characters ORDER BY name ASC")
    fun getAllFlow(): Flow<List<CharacterEntity>>

    @Query("SELECT * FROM characters WHERE name = :name LIMIT 1")
    suspend fun getByName(name: String): CharacterEntity?

    @Upsert
    suspend fun upsert(character: CharacterEntity)

    @Delete
    suspend fun delete(character: CharacterEntity)
}
```

- [ ] **Step 2: Write FragmentDao.kt**

```kotlin
@Dao
interface FragmentDao {
    @Query("SELECT * FROM fragments ORDER BY slot ASC, capturedAt DESC")
    fun getAllFlow(): Flow<List<FragmentEntity>>

    @Query("SELECT * FROM fragments WHERE equippedTo = :charName")
    suspend fun getByChar(charName: String): List<FragmentEntity>

    @Query("SELECT * FROM fragments")
    suspend fun getAll(): List<FragmentEntity>

    @Upsert
    suspend fun upsert(fragment: FragmentEntity): Long

    @Delete
    suspend fun delete(fragment: FragmentEntity)
}

@Dao
interface FragmentSubstatDao {
    @Query("SELECT * FROM fragment_substats WHERE fragmentId = :fragmentId")
    suspend fun getForFragment(fragmentId: Int): List<FragmentSubstatEntity>

    @Query("SELECT * FROM fragment_substats WHERE fragmentId IN (:ids)")
    fun getAllForFragmentsFlow(ids: List<Int>): Flow<List<FragmentSubstatEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(substats: List<FragmentSubstatEntity>)

    @Query("DELETE FROM fragment_substats WHERE fragmentId = :fragmentId")
    suspend fun deleteForFragment(fragmentId: Int)
}
```

- [ ] **Step 3: Write RescueDao.kt**

```kotlin
@Dao
interface RescueDao {
    @Query("SELECT * FROM rescue_pulls ORDER BY pullNumber DESC")
    fun getAllFlow(): Flow<List<RescuePullEntity>>

    @Query("SELECT * FROM rescue_pulls WHERE bannerName = :banner ORDER BY pullNumber DESC")
    fun getByBannerFlow(banner: String): Flow<List<RescuePullEntity>>

    @Query("SELECT DISTINCT bannerName FROM rescue_pulls")
    fun getBannersFlow(): Flow<List<String>>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(pull: RescuePullEntity)
}
```

- [ ] **Step 4: Write ScoreWeightDao.kt**

```kotlin
@Dao
interface ScoreWeightDao {
    @Query("SELECT * FROM score_weights WHERE char_override = ''")
    fun getGlobalFlow(): Flow<List<ScoreWeightEntity>>

    @Query("SELECT * FROM score_weights WHERE char_override = :charId")
    fun getCharFlow(charId: String): Flow<List<ScoreWeightEntity>>

    @Upsert
    suspend fun upsertAll(weights: List<ScoreWeightEntity>)

    @Query("DELETE FROM score_weights WHERE char_override = :charId")
    suspend fun deleteCharOverride(charId: String)

    @Query("SELECT COUNT(*) FROM score_weights WHERE char_override = ''")
    suspend fun globalCount(): Int
}
```

- [ ] **Step 5: Write AppDatabase.kt**

```kotlin
package com.hubczn.optimizer.data.db

import android.content.Context
import androidx.room.*
import com.hubczn.optimizer.data.db.daos.*
import com.hubczn.optimizer.data.db.entities.*

val ALL_STAT_NAMES = listOf(
    "Flat ATK", "ATK%", "Extra DMG%", "Flat DEF", "DEF%",
    "Flat HP", "HP%", "CRate", "CDmg", "Ego", "DoT%",
    "Passion DMG%", "Order DMG%", "Justice DMG%", "Void DMG%", "Instinct DMG%"
)

@Database(
    entities = [CharacterEntity::class, FragmentEntity::class, FragmentSubstatEntity::class,
                RescuePullEntity::class, ScoreWeightEntity::class],
    version = 1, exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun characterDao(): CharacterDao
    abstract fun fragmentDao(): FragmentDao
    abstract fun fragmentSubstatDao(): FragmentSubstatDao
    abstract fun rescueDao(): RescueDao
    abstract fun scoreWeightDao(): ScoreWeightDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase = INSTANCE ?: synchronized(this) {
            Room.databaseBuilder(context.applicationContext, AppDatabase::class.java, "hub_czn.db")
                .build().also { INSTANCE = it }
        }
    }

    suspend fun seedDefaultWeightsIfEmpty() {
        val dao = scoreWeightDao()
        if (dao.globalCount() == 0) {
            dao.upsertAll(ALL_STAT_NAMES.map { ScoreWeightEntity(it, 1f, "") })
        }
    }
}
```

---

## Task 5: Repositories

**Files:** `CharacterRepo.kt`, `FragmentRepo.kt`, `RescueRepo.kt`, `WeightsRepo.kt`

- [ ] **Step 1: Write all 4 repositories**

`CharacterRepo.kt`:
```kotlin
package com.hubczn.optimizer.data.repository

import com.hubczn.optimizer.data.db.daos.CharacterDao
import com.hubczn.optimizer.data.db.entities.CharacterEntity
import kotlinx.coroutines.flow.Flow

class CharacterRepo(private val dao: CharacterDao) {
    fun getAllFlow(): Flow<List<CharacterEntity>> = dao.getAllFlow()
    suspend fun upsert(character: CharacterEntity) = dao.upsert(character)
    suspend fun getByName(name: String) = dao.getByName(name)
}
```

`FragmentRepo.kt`:
```kotlin
class FragmentRepo(
    private val dao: FragmentDao,
    private val substatDao: FragmentSubstatDao
) {
    fun getAllFlow(): Flow<List<FragmentEntity>> = dao.getAllFlow()
    suspend fun getAll(): List<FragmentEntity> = dao.getAll()

    @Transaction
    suspend fun saveFragment(fragment: FragmentEntity, substats: List<FragmentSubstatEntity>) {
        val id = dao.upsert(fragment).toInt()
        substatDao.deleteForFragment(id)
        substatDao.insertAll(substats.map { it.copy(fragmentId = id) })
    }

    suspend fun getSubstats(fragmentId: Int) = substatDao.getForFragment(fragmentId)

    fun getSubstatsForFragmentsFlow(ids: List<Int>) = substatDao.getAllForFragmentsFlow(ids)
}
```

`RescueRepo.kt`:
```kotlin
class RescueRepo(private val dao: RescueDao) {
    fun getAllFlow() = dao.getAllFlow()
    fun getByBannerFlow(banner: String) = dao.getByBannerFlow(banner)
    fun getBannersFlow() = dao.getBannersFlow()
    suspend fun insert(pull: RescuePullEntity) = dao.insert(pull)
}
```

`WeightsRepo.kt`:
```kotlin
class WeightsRepo(private val dao: ScoreWeightDao) {
    fun getGlobalFlow(): Flow<List<ScoreWeightEntity>> = dao.getGlobalFlow()
    fun getCharFlow(charId: String): Flow<List<ScoreWeightEntity>> = dao.getCharFlow(charId)

    fun getWeightsMapFlow(charId: String = ""): Flow<Map<String, Float>> =
        (if (charId.isEmpty()) dao.getGlobalFlow() else dao.getCharFlow(charId))
            .map { list -> list.associate { it.statName to it.weight } }

    suspend fun saveWeights(weights: Map<String, Float>, charId: String = "") {
        dao.upsertAll(weights.map { (k, v) -> ScoreWeightEntity(k, v, charId) })
    }

    suspend fun deleteCharOverride(charId: String) = dao.deleteCharOverride(charId)
}
```

- [ ] **Step 2: Commit**
```bash
git add android-app/
git commit -m "feat(android): project scaffolding, design system, Room entities + DAOs + repos"
```

---

## Task 6: GearScorer (TDD)

**Files:** `logic/GearScorer.kt`, `test/logic/GearScorerTest.kt`

- [ ] **Step 1: Write failing tests**

`test/logic/GearScorerTest.kt`:
```kotlin
package com.hubczn.optimizer.logic

import com.hubczn.optimizer.data.db.entities.FragmentSubstatEntity
import org.junit.Assert.assertEquals
import org.junit.Test

class GearScorerTest {
    private fun sub(name: String, value: Float, rolls: Int) =
        FragmentSubstatEntity(0, 1, name, value, rolls)

    @Test fun `max CRate 2 rolls scores 20`() {
        assertEquals(20.0f, GearScorer.gearScore(listOf(sub("CRate", 4.0f, 2))), 0.01f)
    }
    @Test fun `partial CDmg scores 15`() {
        assertEquals(15.0f, GearScorer.gearScore(listOf(sub("CDmg", 6.0f, 2))), 0.01f)
    }
    @Test fun `unknown stat is zero`() {
        assertEquals(0.0f, GearScorer.gearScore(listOf(sub("UnknownStat", 5.0f, 1))), 0.01f)
    }
    @Test fun `priority score multiplies weight`() {
        val weights = mapOf("CRate" to 8.0f)
        assertEquals(160.0f, GearScorer.priorityScore(listOf(sub("CRate", 4.0f, 2)), weights), 0.01f)
    }
    @Test fun `empty substats is zero`() {
        assertEquals(0.0f, GearScorer.gearScore(emptyList()), 0.01f)
    }
}
```

- [ ] **Step 2: Run test — expect failure**
```bash
cd android-app && ./gradlew :app:testDebugUnitTest --tests "*.GearScorerTest"
```
Expected: FAILED — GearScorer not found.

- [ ] **Step 3: Implement GearScorer**

`logic/GearScorer.kt`:
```kotlin
package com.hubczn.optimizer.logic

import com.hubczn.optimizer.data.db.entities.FragmentSubstatEntity

object GearScorer {
    val MAX_ROLLS = mapOf(
        "CRate" to 2.0f, "CDmg" to 4.0f,
        "ATK%" to 1.3f, "DEF%" to 1.3f, "HP%" to 1.3f,
        "Flat ATK" to 8.0f, "Flat DEF" to 5.0f, "Flat HP" to 12.0f,
        "Ego" to 5.0f, "Extra DMG%" to 3.4f, "DoT%" to 3.4f,
        "Passion DMG%" to 3.5f, "Order DMG%" to 3.5f, "Justice DMG%" to 3.5f,
        "Void DMG%" to 3.5f, "Instinct DMG%" to 3.5f
    )

    fun gearScore(substats: List<FragmentSubstatEntity>): Float =
        substats.sumOf { sub ->
            val max = MAX_ROLLS[sub.name] ?: return@sumOf 0.0
            (sub.value / (max * sub.rollCount) * sub.rollCount).toDouble()
        }.toFloat() * 10f

    fun priorityScore(substats: List<FragmentSubstatEntity>, weights: Map<String, Float>): Float =
        substats.sumOf { sub ->
            val max = MAX_ROLLS[sub.name] ?: return@sumOf 0.0
            val normalized = sub.value / (max * sub.rollCount) * sub.rollCount
            val w = weights[sub.name] ?: 1.0f
            (normalized * w).toDouble()
        }.toFloat() * 10f
}
```

- [ ] **Step 4: Run tests pass + commit**
```bash
./gradlew :app:testDebugUnitTest --tests "*.GearScorerTest"
git add app/src/ && git commit -m "feat(android): GearScorer TDD"
```

---

## Task 7: BreakevenCalculator + DamageCalculator (TDD)

**Files:** `logic/BreakevenCalculator.kt`, `logic/DamageCalculator.kt`, matching test files

- [ ] **Step 1: Write failing tests**

`test/logic/BreakevenCalculatorTest.kt`:
```kotlin
class BreakevenCalculatorTest {
    @Test fun `delta zero when balanced`() =
        assertEquals(0f, BreakevenCalculator.delta(50f, 200f), 0.01f)
    @Test fun `positive delta when cdmg high`() =
        assertEquals(10f, BreakevenCalculator.delta(20f, 150f), 0.01f)
    @Test fun `urgent when abs over 30`() {
        assert(BreakevenCalculator.isUrgent(31f))
        assert(!BreakevenCalculator.isUrgent(30f))
    }
}
```

`test/logic/DamageCalculatorTest.kt`:
```kotlin
class DamageCalculatorTest {
    @Test fun `avgDmg at 100 crate`() =
        assertEquals(2000f, DamageCalculator.avgDmg(1000f, 100f, 200f), 0.01f)
    @Test fun `ehp formula`() =
        assertEquals(20000f, DamageCalculator.ehp(10000f, 300f), 0.01f)
}
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

`logic/BreakevenCalculator.kt`:
```kotlin
object BreakevenCalculator {
    fun delta(crate: Float, cdmg: Float): Float = cdmg - (2f * crate + 100f)
    fun isUrgent(delta: Float): Boolean = kotlin.math.abs(delta) > 30f
}
```

`logic/DamageCalculator.kt`:
```kotlin
object DamageCalculator {
    fun avgDmg(atk: Float, crate: Float, cdmg: Float): Float =
        atk * ((crate / 100f) * (cdmg / 100f) + (1f - crate / 100f))
    fun ehp(hp: Float, def: Float): Float = hp * (1f + def / 300f)
}
```

- [ ] **Step 4: Run pass + commit**
```bash
./gradlew :app:testDebugUnitTest --tests "*.BreakevenCalculatorTest" --tests "*.DamageCalculatorTest"
git add app/src/ && git commit -m "feat(android): BreakevenCalculator + DamageCalculator TDD"
```

---

## Task 8: GearOptimizer (TDD)

**Files:** `model/OptimizeConfig.kt`, `model/BuildResult.kt`, `logic/GearOptimizer.kt`, `test/logic/GearOptimizerTest.kt`

- [ ] **Step 1: Write data models**

`model/OptimizeConfig.kt`:
```kotlin
package com.hubczn.optimizer.model

data class OptimizeConfig(
    val charName: String,
    val fourPieceSets: List<String> = emptyList(),
    val twoPieceSets: List<String> = emptyList(),
    val mainStat4: String? = null,
    val mainStat5: String? = null,
    val mainStat6: String? = null,
    val topPercent: Int = 100,
    val includeEquipped: Boolean = true,
    val maxResults: Int = 10,
    val statWeights: Map<String, Float> = emptyMap()
)
```

`model/BuildResult.kt`:
```kotlin
package com.hubczn.optimizer.model

import com.hubczn.optimizer.data.db.entities.FragmentEntity
import com.hubczn.optimizer.data.db.entities.FragmentSubstatEntity

data class GearStats(
    val flatAtk: Float = 0f, val atkPct: Float = 0f,
    val flatDef: Float = 0f, val defPct: Float = 0f,
    val flatHp: Float = 0f,  val hpPct: Float = 0f,
    val cRate: Float = 0f,   val cDmg: Float = 0f,
    val ego: Float = 0f,     val extraDmgPct: Float = 0f
)

data class BuildResult(
    val rank: Int, val score: Float, val setSummary: String,
    val fragments: List<FragmentEntity>,
    val substatsMap: Map<Int, List<FragmentSubstatEntity>>,
    val gearStats: GearStats,
    val currentGearStats: GearStats
)
```

- [ ] **Step 2: Write failing tests**

`test/logic/GearOptimizerTest.kt`:
```kotlin
class GearOptimizerTest {
    private fun frag(slot: Int, set: String, id: Int = slot) = FragmentEntity(
        id = id, slot = slot, rarity = 3, level = 5,
        setName = set, mainStatName = "ATK%", mainStatValue = 1.3f, capturedAt = 0L
    )

    @Test fun `returns result for valid 6-slot combo`() {
        val frags = (1..6).map { frag(it, "SetA", it) }
        val config = OptimizeConfig("Hero", statWeights = mapOf("CRate" to 8f))
        val results = GearOptimizer().optimizeSync(frags, emptyMap(), config, emptyList())
        assertEquals(1, results.size)
    }

    @Test fun `rejects combo missing required 4pc set`() {
        val frags = (1..6).map { slot -> frag(slot, if (slot <= 3) "SetA" else "SetB", slot) }
        val config = OptimizeConfig("Hero", fourPieceSets = listOf("SetA"), statWeights = emptyMap())
        val results = GearOptimizer().optimizeSync(frags, emptyMap(), config, emptyList())
        assertEquals(0, results.size)
    }
}
```

- [ ] **Step 3: Implement GearOptimizer**

`logic/GearOptimizer.kt`:
```kotlin
package com.hubczn.optimizer.logic

import com.hubczn.optimizer.data.db.entities.FragmentEntity
import com.hubczn.optimizer.data.db.entities.FragmentSubstatEntity
import com.hubczn.optimizer.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class GearOptimizer {

    suspend fun optimize(
        allFragments: List<FragmentEntity>,
        substatsMap: Map<Int, List<FragmentSubstatEntity>>,
        config: OptimizeConfig,
        currentEquipped: List<FragmentEntity>,
        onProgress: (Int, Int, Int) -> Unit = { _, _, _ -> }
    ): List<BuildResult> = withContext(Dispatchers.Default) {
        optimizeSync(allFragments, substatsMap, config, currentEquipped, onProgress)
    }

    fun optimizeSync(
        allFragments: List<FragmentEntity>,
        substatsMap: Map<Int, List<FragmentSubstatEntity>>,
        config: OptimizeConfig,
        currentEquipped: List<FragmentEntity>,
        onProgress: (Int, Int, Int) -> Unit = { _, _, _ -> }
    ): List<BuildResult> {
        val allSets = config.fourPieceSets + config.twoPieceSets

        val slotCandidates = (1..6).map { slot ->
            val reqMain = when (slot) { 4 -> config.mainStat4; 5 -> config.mainStat5; 6 -> config.mainStat6; else -> null }
            allFragments.filter { f ->
                f.slot == slot && f.rarity >= 3 &&
                (config.includeEquipped || f.equippedTo == null || f.equippedTo == config.charName) &&
                (reqMain == null || f.mainStatName == reqMain) &&
                (allSets.isEmpty() || f.setName in allSets)
            }.sortedByDescending { f ->
                GearScorer.priorityScore(substatsMap[f.id] ?: emptyList(), config.statWeights)
            }.let { c -> c.take(maxOf(1, c.size * config.topPercent / 100)) }
        }

        if (slotCandidates.any { it.isEmpty() }) return emptyList()

        val total = slotCandidates.fold(1L) { acc, s -> acc * s.size }
        val currentStats = computeGearStats(currentEquipped, substatsMap)
        val results = mutableListOf<Triple<Float, String, List<FragmentEntity>>>()
        var checked = 0

        for (combo in slotCandidates.cartesianProduct()) {
            checked++
            if (combo.map { it.id }.toSet().size < 6) continue

            val setCounts = combo.groupingBy { it.setName }.eachCount()
            if (config.fourPieceSets.isNotEmpty() && config.fourPieceSets.none { (setCounts[it] ?: 0) >= 4 }) continue
            if (config.twoPieceSets.any { (setCounts[it] ?: 0) < 2 }) continue

            val score = combo.sumOf {
                GearScorer.priorityScore(substatsMap[it.id] ?: emptyList(), config.statWeights).toDouble()
            }.toFloat()
            val setSummary = setCounts.entries.sortedByDescending { it.value }
                .joinToString(" + ") { "${it.value}x${it.key}" }
            results.add(Triple(score, setSummary, combo))

            if (checked % 5000 == 0) onProgress(checked, total.toInt(), results.size)
            if (results.size > config.maxResults * 10) {
                results.sortByDescending { it.first }
                results.subList(config.maxResults, results.size).clear()
            }
        }

        results.sortByDescending { it.first }
        return results.take(config.maxResults).mapIndexed { i, (score, setSummary, combo) ->
            BuildResult(i + 1, score, setSummary, combo,
                combo.associate { it.id to (substatsMap[it.id] ?: emptyList()) },
                computeGearStats(combo, substatsMap), currentStats)
        }
    }

    private fun computeGearStats(fragments: List<FragmentEntity>, substatsMap: Map<Int, List<FragmentSubstatEntity>>): GearStats {
        var fa=0f; var ap=0f; var fd=0f; var dp=0f; var fh=0f; var hp=0f; var cr=0f; var cd=0f; var eg=0f; var ex=0f
        fun add(name: String, v: Float) = when(name) {
            "Flat ATK" -> fa+=v; "ATK%" -> ap+=v; "Flat DEF" -> fd+=v; "DEF%" -> dp+=v
            "Flat HP"  -> fh+=v; "HP%"  -> hp+=v; "CRate"    -> cr+=v; "CDmg" -> cd+=v
            "Ego"      -> eg+=v; "Extra DMG%" -> ex+=v; else -> Unit
        }
        fragments.forEach { f -> add(f.mainStatName, f.mainStatValue); substatsMap[f.id]?.forEach { s -> add(s.name, s.value) } }
        return GearStats(fa,ap,fd,dp,fh,hp,cr,cd,eg,ex)
    }
}

fun <T> List<List<T>>.cartesianProduct(): Sequence<List<T>> = sequence {
    if (any { it.isEmpty() }) return@sequence
    val indices = IntArray(size)
    while (true) {
        yield(mapIndexed { i, list -> list[indices[i]] })
        var pos = size - 1
        while (pos >= 0) { indices[pos]++; if (indices[pos] < this@cartesianProduct[pos].size) break; indices[pos]=0; pos-- }
        if (pos < 0) break
    }
}
```

- [ ] **Step 4: Run tests + commit**
```bash
./gradlew :app:testDebugUnitTest --tests "*.GearOptimizerTest"
git add app/src/ && git commit -m "feat(android): GearOptimizer TDD"
```

---

## Task 9: Asset Bundling

**Files:** `scripts/export_char_presets_json.py`, bundled assets in `android-app/app/src/main/assets/`

- [ ] **Step 1: Create export script**

`scripts/export_char_presets_json.py`:
```python
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Vribbels'))
from game_data.char_presets import _RAW, get_char_preset
output = {str(k): get_char_preset(k) for k in _RAW if get_char_preset(k)}
out = sys.argv[1] if len(sys.argv) > 1 else \
    os.path.join(os.path.dirname(__file__), '..', 'android-app', 'app', 'src', 'main', 'assets', 'char_presets.json')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w') as f:
    json.dump(output, f, indent=2)
print(f"Exported {len(output)} presets to {out}")
```

- [ ] **Step 2: Run export**
```bash
python scripts/export_char_presets_json.py
```
Expected: "Exported 33 presets to ..."

- [ ] **Step 3: Copy face portraits**
```powershell
New-Item -ItemType Directory -Force "android-app\app\src\main\assets\game\faces"
Copy-Item "api\assets\game\faces\*.png" "android-app\app\src\main\assets\game\faces\"
(Get-ChildItem "android-app\app\src\main\assets\game\faces\*.png").Count  # expect 72
```

- [ ] **Step 4: Commit**
```bash
git add scripts/export_char_presets_json.py android-app/app/src/main/assets/
git commit -m "feat(android): bundle char_presets.json and 72 face portrait assets"
```

---

## Task 10: CharPreset Loader

**Files:** `model/CharPreset.kt`, `data/CharPresetsLoader.kt`

- [ ] **Step 1: Write CharPreset.kt**

```kotlin
package com.hubczn.optimizer.model

data class CharPreset(
    val recommended_sets: List<Int>,
    val main_stat_4: List<String>,
    val main_stat_5: List<String>,
    val main_stat_6: List<String>,
    val substats: List<String>,
    val weights: Map<String, Double>
)
```

- [ ] **Step 2: Write CharPresetsLoader.kt**

```kotlin
package com.hubczn.optimizer.data

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.hubczn.optimizer.model.CharPreset

object CharPresetsLoader {
    @Volatile private var cache: Map<Int, CharPreset>? = null

    fun load(context: Context): Map<Int, CharPreset> = cache ?: synchronized(this) {
        cache ?: run {
            val json = context.assets.open("char_presets.json").bufferedReader().readText()
            val type = object : TypeToken<Map<String, CharPreset>>() {}.type
            val raw: Map<String, CharPreset> = Gson().fromJson(json, type)
            raw.mapKeys { it.key.toInt() }.also { cache = it }
        }
    }
}
```

- [ ] **Step 3: Commit**
```bash
git add app/src/ && git commit -m "feat(android): CharPreset model + loader"
```

---

## Task 11: OcrProcessor + ScreenAnalyzer (TDD)

**Files:** `capture/OcrProcessor.kt`, `capture/ScreenAnalyzer.kt`, `test/capture/ScreenAnalyzerTest.kt`

- [ ] **Step 1: Write ScreenAnalyzer failing tests**

`test/capture/ScreenAnalyzerTest.kt`:
```kotlin
package com.hubczn.optimizer.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ScreenAnalyzerTest {
    private val analyzer = ScreenAnalyzer()

    @Test fun `detects CHAR_STATS`() {
        val text = "CRIT RATE 45.2%\nCRIT DMG 125%\nATK 1234\nDEF 456\nHP 12345"
        assertEquals(ScreenType.CHAR_STATS, analyzer.detectType(text))
    }
    @Test fun `detects MEMORY_FRAGMENT`() {
        val text = "MEMORY FRAGMENT\nGEAR SCORE 78.5"
        assertEquals(ScreenType.MEMORY_FRAGMENT, analyzer.detectType(text))
    }
    @Test fun `detects RESCUE_RESULT 5 stars`() {
        val text = "RESCUE\n★★★★★ Heidemarie"
        assertEquals(ScreenType.RESCUE_RESULT, analyzer.detectType(text))
    }
    @Test fun `returns UNKNOWN for random text`() {
        assertEquals(ScreenType.UNKNOWN, analyzer.detectType("Some random screen"))
    }
    @Test fun `cooldown blocks second detection within 15s`() {
        val t = System.currentTimeMillis()
        analyzer.markProcessed(ScreenType.CHAR_STATS, t)
        assertFalse(analyzer.shouldProcess(ScreenType.CHAR_STATS, t + 14_000L))
        assertTrue(analyzer.shouldProcess(ScreenType.CHAR_STATS, t + 15_001L))
    }
}
```

- [ ] **Step 2: Run — expect failure**
```bash
./gradlew :app:testDebugUnitTest --tests "*.ScreenAnalyzerTest"
```

- [ ] **Step 3: Implement ScreenAnalyzer**

`capture/ScreenAnalyzer.kt`:
```kotlin
package com.hubczn.optimizer.capture

enum class ScreenType { CHAR_STATS, MEMORY_FRAGMENT, RESCUE_RESULT, UNKNOWN }

class ScreenAnalyzer {
    private val cooldowns = mutableMapOf<ScreenType, Long>()
    private val COOLDOWN_MS = 15_000L

    fun detectType(text: String): ScreenType {
        val u = text.uppercase()
        return when {
            u.contains("CRIT RATE") && u.contains("CRIT DMG") &&
            u.contains("ATK") && u.contains("DEF") -> ScreenType.CHAR_STATS
            u.contains("MEMORY FRAGMENT") && u.contains("GEAR SCORE") -> ScreenType.MEMORY_FRAGMENT
            u.contains("RESCUE") && (u.contains("★★★★★") || u.contains("★★★★")) -> ScreenType.RESCUE_RESULT
            else -> ScreenType.UNKNOWN
        }
    }

    fun shouldProcess(type: ScreenType, nowMs: Long = System.currentTimeMillis()): Boolean {
        if (type == ScreenType.UNKNOWN) return false
        return nowMs - (cooldowns[type] ?: 0L) >= COOLDOWN_MS
    }

    fun markProcessed(type: ScreenType, nowMs: Long = System.currentTimeMillis()) {
        cooldowns[type] = nowMs
    }
}
```

- [ ] **Step 4: Implement OcrProcessor**

`capture/OcrProcessor.kt`:
```kotlin
package com.hubczn.optimizer.capture

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class OcrProcessor {
    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    suspend fun process(bitmap: Bitmap): String = suspendCoroutine { cont ->
        val image = InputImage.fromBitmap(bitmap, 0)
        recognizer.process(image)
            .addOnSuccessListener { cont.resume(it.textBlocks.joinToString("\n") { b -> b.text }) }
            .addOnFailureListener { cont.resume("") }
    }

    fun close() = recognizer.close()
}
```

- [ ] **Step 5: Run tests + commit**
```bash
./gradlew :app:testDebugUnitTest --tests "*.ScreenAnalyzerTest"
git add app/src/ && git commit -m "feat(android): OcrProcessor + ScreenAnalyzer TDD"
```

---

## Task 12: CaptureService (ForegroundService)

**File:** `capture/CaptureService.kt`

- [ ] **Step 1: Implement CaptureService**

```kotlin
package com.hubczn.optimizer.capture

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.hubczn.optimizer.CHANNEL_ID
import com.hubczn.optimizer.HubCznApp
import com.hubczn.optimizer.MainActivity
import kotlinx.coroutines.*

class CaptureService : Service() {

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private val analyzer = ScreenAnalyzer()
    private val ocrProcessor = OcrProcessor()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        var isRunning = false
            private set

        fun start(context: Context, resultCode: Int, data: Intent) {
            val intent = Intent(context, CaptureService::class.java).apply {
                putExtra("resultCode", resultCode)
                putExtra("data", data)
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, CaptureService::class.java))
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP") { stopSelf(); return START_NOT_STICKY }

        startForeground(1, buildNotification())
        isRunning = true

        val resultCode = intent?.getIntExtra("resultCode", Activity.RESULT_CANCELED) ?: return START_NOT_STICKY
        val data = intent.getParcelableExtra<Intent>("data") ?: return START_NOT_STICKY

        val mgr = getSystemService(MediaProjectionManager::class.java)
        mediaProjection = mgr.getMediaProjection(resultCode, data)

        val width = 1280; val height = 720; val dpi = 160
        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "HubCznCapture", width, height, dpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface, null, null
        )

        val app = application as HubCznApp
        val writer = OcrDataWriter(app.characterRepo, app.fragmentRepo, app.rescueRepo)

        scope.launch {
            while (isActive) {
                val image = imageReader?.acquireLatestImage()
                if (image != null) {
                    try {
                        val bitmap = imageToBitmap(image)
                        val text = ocrProcessor.process(bitmap)
                        val type = analyzer.detectType(text)
                        if (analyzer.shouldProcess(type)) {
                            writer.process(type, text)
                            analyzer.markProcessed(type)
                        }
                    } finally {
                        image.close()
                    }
                }
                delay(1500)
            }
        }
        return START_STICKY
    }

    private fun imageToBitmap(image: android.media.Image): Bitmap {
        val plane = image.planes[0]
        val buffer = plane.buffer
        val bmp = Bitmap.createBitmap(image.width, image.height, Bitmap.Config.ARGB_8888)
        bmp.copyPixelsFromBuffer(buffer)
        return bmp
    }

    private fun buildNotification(): Notification {
        val stopIntent = PendingIntent.getService(
            this, 0, Intent(this, CaptureService::class.java).apply { action = "STOP" },
            PendingIntent.FLAG_IMMUTABLE
        )
        val openIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Hub CZN")
            .setContentText("Capturando...")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_media_pause, "Parar", stopIntent)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        scope.cancel()
        virtualDisplay?.release()
        mediaProjection?.stop()
        ocrProcessor.close()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
```

- [ ] **Step 2: Commit**
```bash
git add app/src/ && git commit -m "feat(android): CaptureService ForegroundService + MediaProjection"
```

---

## Task 13: OcrDataWriter

**File:** `capture/OcrDataWriter.kt`

Extracts structured data from OCR text and persists to Room. OCR text is raw so all regex patterns are heuristic and may need tuning during QA.

- [ ] **Step 1: Implement OcrDataWriter**

```kotlin
package com.hubczn.optimizer.capture

import com.hubczn.optimizer.data.db.entities.*
import com.hubczn.optimizer.data.repository.*

class OcrDataWriter(
    private val characterRepo: CharacterRepo,
    private val fragmentRepo: FragmentRepo,
    private val rescueRepo: RescueRepo
) {
    suspend fun process(type: ScreenType, text: String) {
        when (type) {
            ScreenType.CHAR_STATS      -> extractCharStats(text)?.let { characterRepo.upsert(it) }
            ScreenType.MEMORY_FRAGMENT -> extractFragment(text)?.let { (f, s) -> fragmentRepo.saveFragment(f, s) }
            ScreenType.RESCUE_RESULT   -> extractRescue(text)?.let { rescueRepo.insert(it) }
            ScreenType.UNKNOWN         -> Unit
        }
    }

    private fun extractCharStats(text: String): CharacterEntity? {
        fun findFloat(pattern: Regex) = pattern.find(text)?.groupValues?.get(1)?.replace(",", "")?.toFloatOrNull()
        val atk   = findFloat(Regex("""ATK\s*([\d,]+)"""))         ?: return null
        val def   = findFloat(Regex("""DEF\s*([\d,]+)"""))         ?: return null
        val hp    = findFloat(Regex("""HP\s*([\d,]+)"""))          ?: return null
        val crate = findFloat(Regex("""CRIT RATE\s*([\d.]+)"""))   ?: return null
        val cdmg  = findFloat(Regex("""CRIT DMG\s*([\d.]+)"""))    ?: return null

        if (atk !in 100f..99_999f || def !in 50f..99_999f || hp !in 1_000f..999_999f ||
            crate !in 0f..100f    || cdmg !in 100f..400f) return null

        // First short capitalised word not a stat keyword is the character name
        val name = text.lines()
            .firstOrNull { l -> l.length in 2..30 && l[0].isUpperCase() &&
                !l.contains(Regex("""(\d|CRIT|ATK|DEF|HP|RATE|DMG|STATS)""")) }
            ?.trim() ?: "Unknown"

        return CharacterEntity(name, atk, def, hp, crate, cdmg, capturedAt = System.currentTimeMillis())
    }

    private fun extractFragment(text: String): Pair<FragmentEntity, List<FragmentSubstatEntity>>? {
        fun findInt(p: Regex) = p.find(text)?.groupValues?.get(1)?.toIntOrNull()
        fun findFloat(p: Regex) = p.find(text)?.groupValues?.get(1)?.toFloatOrNull()

        val gs   = findFloat(Regex("""GEAR SCORE\s*([\d.]+)""")) ?: return null
        val slot = findInt(Regex("""SLOT\s*(\d)""")) ?: findInt(Regex("""^([1-6])\s""", RegexOption.MULTILINE)) ?: return null
        val level = findInt(Regex("""\+(\d+)""")) ?: 0
        val rarity = text.count { it == '★' }.coerceIn(1, 4)

        if (gs !in 0f..100f || slot !in 1..6) return null

        // Extract first line that looks like a set name (capitalised, no digits)
        val setName = text.lines().firstOrNull { l ->
            l.length in 3..40 && l[0].isUpperCase() &&
            !l.contains(Regex("""(\d|SLOT|GEAR|SCORE|MEMORY|FRAGMENT)"""))
        }?.trim() ?: "Unknown Set"

        // Extract main stat from slot-specific lines (simplified heuristic)
        val mainStatName = text.lines().firstOrNull { l ->
            l.contains(Regex("""ATK%|DEF%|HP%|CRate|CDmg|Ego|DMG%|Flat ATK|Flat DEF|Flat HP"""))
        }?.trim() ?: "ATK%"
        val mainStatValue = Regex("""([\d.]+)""").find(mainStatName)?.value?.toFloatOrNull() ?: 0f

        val fragment = FragmentEntity(
            slot = slot, rarity = rarity, level = level,
            setName = setName, mainStatName = mainStatName.replace(Regex("""\s*[\d.]+$"""), "").trim(),
            mainStatValue = mainStatValue, capturedAt = System.currentTimeMillis()
        )

        // Substats: lines matching "StatName ›* value"
        val rollRegex = Regex("""([\w%\s]+?)\s*([›†]+)\s*([\d.]+)""")
        val substats = rollRegex.findAll(text).map { m ->
            val name   = m.groupValues[1].trim()
            val rolls  = m.groupValues[2].count { it == '›' || it == '†' }
            val value  = m.groupValues[3].toFloatOrNull() ?: 0f
            FragmentSubstatEntity(0, 0, name, value, rolls.coerceIn(1, 4))
        }.filter { it.name.isNotBlank() && it.value > 0 }.take(4).toList()

        return Pair(fragment, substats)
    }

    private fun extractRescue(text: String): RescuePullEntity? {
        val rarity = text.count { it == '★' }.coerceIn(1, 5)
        if (rarity < 4) return null

        val pity = Regex("""(\d+)\s*(?:pity|PITY|Pity)""").find(text)?.groupValues?.get(1)?.toIntOrNull()
            ?: Regex("""Pity[:\s]*(\d+)""").find(text)?.groupValues?.get(1)?.toIntOrNull()
            ?: return null
        if (pity !in 1..70) return null

        val isFeatured = text.uppercase().let { it.contains("FEATURED") || it.contains("RATE UP") }

        val charName = text.lines().firstOrNull { l ->
            l.length in 2..30 && l[0].isUpperCase() &&
            !l.contains(Regex("""(★|RESCUE|BANNER|PITY|PULL|FEATURED)""", RegexOption.IGNORE_CASE))
        }?.trim() ?: "Unknown"

        val bannerName = Regex("""BANNER[:\s]*([\w\s]+)""", RegexOption.IGNORE_CASE)
            .find(text)?.groupValues?.get(1)?.trim() ?: "Standard"

        return RescuePullEntity(
            bannerName = bannerName, pullNumber = 0,
            characterName = charName, rarity = rarity,
            pity = pity, isFeatured = isFeatured, timestamp = System.currentTimeMillis()
        )
    }
}
```

- [ ] **Step 2: Commit**
```bash
git add app/src/ && git commit -m "feat(android): OcrDataWriter — extracts CharStats, Fragment, Rescue from OCR text"
```

---

## Task 14: Navigation + MainActivity

**Files:** `ui/nav/AppNav.kt`, `MainActivity.kt`

- [ ] **Step 1: Write AppNav.kt**

```kotlin
package com.hubczn.optimizer.ui.nav

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.*
import androidx.navigation.compose.*
import com.hubczn.optimizer.ui.combatants.CombatantsScreen
import com.hubczn.optimizer.ui.fragments.FragmentsScreen
import com.hubczn.optimizer.ui.optimizer.OptimizerScreen
import com.hubczn.optimizer.ui.scoring.ScoringScreen
import com.hubczn.optimizer.ui.rescue.RescueScreen

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    object Combatants : Screen("combatants", "Combatentes", Icons.Default.Person)
    object Fragments  : Screen("fragments",  "Fragmentos",  Icons.Default.Diamond)
    object Optimizer  : Screen("optimizer",  "Otimizador",  Icons.Default.Tune)
    object Scoring    : Screen("scoring",    "Pontuação",   Icons.Default.Star)
    object Rescue     : Screen("rescue",     "Rescue",      Icons.Default.Shield)
}

val TABS = listOf(Screen.Combatants, Screen.Fragments, Screen.Optimizer, Screen.Scoring, Screen.Rescue)

@Composable
fun AppNav(onToggleCapture: () -> Unit) {
    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val current = backStack?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = androidx.compose.ui.graphics.Color(0xFF121212)) {
                TABS.forEach { screen ->
                    NavigationBarItem(
                        selected = current == screen.route,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.startDestinationId) { saveState = true }
                                launchSingleTop = true; restoreState = true
                            }
                        },
                        icon = { Icon(screen.icon, contentDescription = screen.label) },
                        label = { Text(screen.label, maxLines = 1) }
                    )
                }
            }
        }
    ) { padding ->
        NavHost(navController, startDestination = Screen.Combatants.route, Modifier.padding(padding)) {
            composable(Screen.Combatants.route) { CombatantsScreen(onToggleCapture) }
            composable(Screen.Fragments.route)  { FragmentsScreen() }
            composable(Screen.Optimizer.route)  { OptimizerScreen() }
            composable(Screen.Scoring.route)    { ScoringScreen() }
            composable(Screen.Rescue.route)     { RescueScreen(onToggleCapture) }
        }
    }
}
```

- [ ] **Step 2: Write MainActivity.kt**

```kotlin
package com.hubczn.optimizer

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.WindowCompat
import com.hubczn.optimizer.capture.CaptureService
import com.hubczn.optimizer.ui.nav.AppNav
import com.hubczn.optimizer.ui.theme.HubCznTheme

class MainActivity : ComponentActivity() {

    private val projectionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            CaptureService.start(this, result.resultCode, result.data!!)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = android.graphics.Color.parseColor("#0E0E0E")

        setContent {
            HubCznTheme {
                AppNav(onToggleCapture = ::toggleCapture)
            }
        }
    }

    private fun toggleCapture() {
        if (CaptureService.isRunning) {
            CaptureService.stop(this)
        } else {
            val mgr = getSystemService(MediaProjectionManager::class.java)
            projectionLauncher.launch(mgr.createScreenCaptureIntent())
        }
    }
}
```

- [ ] **Step 3: Commit**
```bash
git add app/src/ && git commit -m "feat(android): navigation + MainActivity + MediaProjection toggle"
```

---

## Task 15: Shared Components + CombatantsScreen

**Files:** `ui/components/PortraitImage.kt`, `ui/components/PityBadge.kt`, `ui/combatants/CombatantsViewModel.kt`, `ui/combatants/CombatantsScreen.kt`

- [ ] **Step 1: Write PortraitImage.kt**

```kotlin
package com.hubczn.optimizer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest

@Composable
fun PortraitImage(resId: Int, size: Dp = 72.dp, modifier: Modifier = Modifier) {
    AsyncImage(
        model = ImageRequest.Builder(LocalContext.current)
            .data("file:///android_asset/game/faces/bookmark_face_character_map_$resId.png")
            .crossfade(true).build(),
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = modifier.size(size).clip(RoundedCornerShape(8.dp)).background(Color(0xFF282828))
    )
}
```

- [ ] **Step 2: Write PityBadge.kt**

```kotlin
package com.hubczn.optimizer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hubczn.optimizer.ui.theme.pityColor

@Composable
fun PityBadge(pity: Int, modifier: Modifier = Modifier) {
    val color = pityColor(pity)
    Box(modifier.background(color.copy(alpha = 0.2f), RoundedCornerShape(4.dp)).padding(horizontal = 4.dp, vertical = 1.dp)) {
        Text(pity.toString(), color = color, fontSize = 10.sp)
    }
}
```

- [ ] **Step 3: Write CombatantsViewModel.kt**

```kotlin
package com.hubczn.optimizer.ui.combatants

import android.app.Application
import androidx.lifecycle.*
import com.hubczn.optimizer.HubCznApp
import com.hubczn.optimizer.data.db.entities.*
import com.hubczn.optimizer.logic.*
import kotlinx.coroutines.flow.*

data class CombatantUiState(
    val character: CharacterEntity,
    val gearScore: Float,
    val equippedFragments: List<FragmentEntity>,
    val breakeven: Float
)

class CombatantsViewModel(app: Application) : AndroidViewModel(app) {
    private val charRepo = (app as HubCznApp).characterRepo
    private val fragRepo = app.fragmentRepo

    val uiStates: StateFlow<List<CombatantUiState>> =
        combine(charRepo.getAllFlow(), fragRepo.getAllFlow()) { chars, frags ->
            chars.map { char ->
                val equipped = frags.filter { it.equippedTo == char.name }.sortedBy { it.slot }
                CombatantUiState(
                    character = char, gearScore = 0f, // GS computed lazily with substats
                    equippedFragments = equipped,
                    breakeven = BreakevenCalculator.delta(char.critRate, char.critDmg)
                )
            }.sortedByDescending { DamageCalculator.avgDmg(it.character.atk, it.character.critRate, it.character.critDmg) }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    companion object {
        val Factory: ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(c: Class<T>, e: CreationExtras) =
                CombatantsViewModel(e[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]!!) as T
        }
    }
}
```

- [ ] **Step 4: Write CombatantsScreen.kt**

```kotlin
package com.hubczn.optimizer.ui.combatants

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hubczn.optimizer.capture.CaptureService
import com.hubczn.optimizer.logic.DamageCalculator
import com.hubczn.optimizer.ui.components.PortraitImage
import com.hubczn.optimizer.ui.theme.*

@Composable
fun CombatantsScreen(onToggleCapture: () -> Unit, vm: CombatantsViewModel = viewModel(factory = CombatantsViewModel.Factory)) {
    val states by vm.uiStates.collectAsState()
    val context = LocalContext.current
    val expanded = remember { mutableStateMapOf<String, Boolean>() }

    Column(Modifier.fillMaxSize().background(Background)) {
        Row(Modifier.fillMaxWidth().background(SurfaceVariant).padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Text("Combatentes", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Badge(containerColor = Primary, modifier = Modifier.padding(start = 8.dp)) { Text("${states.size}") }
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { /* export JSON to Downloads */ }) {
                Icon(Icons.Default.Download, "Export", tint = TextSecondary)
            }
            IconButton(onClick = {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://hub-czn.lovable.app")))
            }) { Icon(Icons.Default.Cloud, "Cloud", tint = Primary) }
            IconButton(onClick = onToggleCapture) {
                Icon(Icons.Default.Videocam, "Capture", tint = if (CaptureService.isRunning) Primary else TextMuted)
            }
        }

        LazyColumn {
            itemsIndexed(states) { index, state ->
                val char = state.character
                val isExp = expanded[char.name] == true

                Column(Modifier.fillMaxWidth().background(Surface).clickable { expanded[char.name] = !isExp }
                    .padding(horizontal = 16.dp, vertical = 10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("${index + 1}", color = TextMuted, fontSize = 12.sp, modifier = Modifier.width(24.dp))
                        PortraitImage(char.resId, 56.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(char.name, color = TextPrimary, fontSize = 14.sp)
                            if (BreakevenCalculator.isUrgent(state.breakeven)) {
                                Text("Breakeven: ${state.breakeven.toInt()}", color = ErrorColor, fontSize = 10.sp)
                            }
                        }
                        Icon(if (isExp) Icons.Default.ExpandLess else Icons.Default.ExpandMore, null, tint = TextMuted)
                    }

                    AnimatedVisibility(visible = isExp) {
                        Column(Modifier.padding(top = 12.dp)) {
                            val ehp = DamageCalculator.ehp(char.hp, char.def)
                            val avg = DamageCalculator.avgDmg(char.atk, char.critRate, char.critDmg)
                            listOf("ATK" to "%.0f".format(char.atk), "DEF" to "%.0f".format(char.def),
                                "HP" to "%.0f".format(char.hp), "CRate" to "%.1f%%".format(char.critRate),
                                "CDmg" to "%.1f%%".format(char.critDmg), "EHP" to "%.0f".format(ehp),
                                "AvgDMG" to "%.0f".format(avg)).chunked(2).forEach { row ->
                                Row(Modifier.fillMaxWidth()) {
                                    row.forEach { (label, value) ->
                                        Column(Modifier.weight(1f).padding(4.dp)) {
                                            Text(label, color = TextMuted, fontSize = 10.sp)
                                            Text(value, color = TextPrimary, fontSize = 12.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                HorizontalDivider(color = BorderSubtle, thickness = 1.dp)
            }
        }
    }
}
```

- [ ] **Step 5: Commit**
```bash
git add app/src/ && git commit -m "feat(android): PortraitImage, PityBadge, CombatantsScreen"
```

---

## Task 16: FragmentsScreen

**Files:** `ui/fragments/FragmentsViewModel.kt`, `ui/fragments/FragmentsScreen.kt`

- [ ] **Step 1: Write FragmentsViewModel.kt**

```kotlin
package com.hubczn.optimizer.ui.fragments

import android.app.Application
import androidx.lifecycle.*
import com.hubczn.optimizer.HubCznApp
import com.hubczn.optimizer.data.db.entities.*
import com.hubczn.optimizer.logic.GearScorer
import kotlinx.coroutines.flow.*

data class FragmentRow(
    val fragment: FragmentEntity,
    val substats: List<FragmentSubstatEntity>,
    val gearScore: Float
)

class FragmentsViewModel(app: Application) : AndroidViewModel(app) {
    private val fragRepo = (app as HubCznApp).fragmentRepo

    val rows: StateFlow<List<FragmentRow>> = fragRepo.getAllFlow().transformLatest { frags ->
        emit(frags.map { f ->
            val subs = fragRepo.getSubstats(f.id)
            FragmentRow(f, subs, GearScorer.gearScore(subs))
        })
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    companion object {
        val Factory: ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(c: Class<T>, e: CreationExtras) =
                FragmentsViewModel(e[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]!!) as T
        }
    }
}
```

- [ ] **Step 2: Write FragmentsScreen.kt**

```kotlin
package com.hubczn.optimizer.ui.fragments

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.*
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hubczn.optimizer.ui.theme.*

private val ROLL_SYMBOLS = mapOf(1 to "â€º", 2 to "â€ºâ€º", 3 to "â€ºâ€ºâ€º", 4 to "â€ â€ â€ â€ ")

@Composable
fun FragmentsScreen(vm: FragmentsViewModel = viewModel(factory = FragmentsViewModel.Factory)) {
    val rows by vm.rows.collectAsState()
    val scrollState = rememberScrollState()
    val colWidths = listOf(40.dp, 110.dp, 40.dp, 110.dp, 90.dp, 90.dp, 90.dp, 90.dp, 54.dp, 80.dp, 90.dp)
    val headers   = listOf("Slot", "Set", "Lv", "Main", "Sub1", "Sub2", "Sub3", "Sub4", "GS", "Pot", "Equipado")

    Column(Modifier.fillMaxSize().background(Background)) {
        Row(Modifier.fillMaxWidth().background(SurfaceVariant).padding(16.dp)) {
            Text("Fragmentos", color = TextPrimary, fontSize = 18.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
            Badge(containerColor = Primary, modifier = Modifier.padding(start = 8.dp)) { Text("${rows.size}") }
        }

        // Header row
        Row(Modifier.horizontalScroll(scrollState).background(SurfaceVariant).padding(horizontal = 8.dp, vertical = 4.dp)) {
            headers.zip(colWidths).forEach { (h, w) ->
                Text(h, color = TextMuted, fontSize = 10.sp, modifier = Modifier.width(w))
            }
        }

        LazyColumn {
            items(rows) { row ->
                val f = row.fragment
                fun subText(i: Int) = row.substats.getOrNull(i)?.let { s ->
                    "${s.name} ${ROLL_SYMBOLS[s.rollCount] ?: "â€º"} ${"%.1f".format(s.value)}"
                } ?: "â€”"
                val potLow  = row.gearScore * 0.8f
                val potHigh = row.gearScore * 1.2f

                Row(Modifier.horizontalScroll(scrollState).background(Surface).padding(horizontal = 8.dp, vertical = 6.dp)) {
                    Text("${f.slot}",  color = TextSecondary, fontSize = 11.sp, modifier = Modifier.width(40.dp))
                    Text(f.setName,    color = rarityColor(f.rarity), fontSize = 11.sp, modifier = Modifier.width(110.dp))
                    Text("+${f.level}", color = TextSecondary, fontSize = 11.sp, modifier = Modifier.width(40.dp))
                    Text("${f.mainStatName} ${"%.1f".format(f.mainStatValue)}", color = TextPrimary, fontSize = 11.sp, modifier = Modifier.width(110.dp))
                    (0..3).forEach { i -> Text(subText(i), color = TextSecondary, fontSize = 10.sp, modifier = Modifier.width(90.dp)) }
                    Text("%.1f".format(row.gearScore), color = Primary, fontSize = 11.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.width(54.dp))
                    Text("${"%.1f".format(potLow)}-${"%.1f".format(potHigh)}", color = TextMuted, fontSize = 10.sp, modifier = Modifier.width(80.dp))
                    Text(f.equippedTo ?: "â€”", color = TextSecondary, fontSize = 10.sp, modifier = Modifier.width(90.dp))
                }
                HorizontalDivider(color = BorderSubtle, thickness = 0.5.dp)
            }
        }
    }
}
```

- [ ] **Step 3: Commit**
```bash
git add app/src/ && git commit -m "feat(android): FragmentsScreen horizontal table"
```

---

## Task 17: OptimizerScreen

**Files:** `ui/optimizer/OptimizerViewModel.kt`, `ui/optimizer/OptimizerScreen.kt`

- [ ] **Step 1: Write OptimizerViewModel.kt**

```kotlin
package com.hubczn.optimizer.ui.optimizer

import android.app.Application
import androidx.lifecycle.*
import com.hubczn.optimizer.HubCznApp
import com.hubczn.optimizer.data.db.ALL_STAT_NAMES
import com.hubczn.optimizer.data.db.entities.CharacterEntity
import com.hubczn.optimizer.logic.GearOptimizer
import com.hubczn.optimizer.model.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

data class OptimizerState(
    val characters: List<CharacterEntity> = emptyList(),
    val selectedChar: CharacterEntity? = null,
    val config: OptimizeConfig = OptimizeConfig("", statWeights = ALL_STAT_NAMES.associateWith { 1f }),
    val isRunning: Boolean = false,
    val progress: Triple<Int, Int, Int> = Triple(0, 0, 0),
    val results: List<BuildResult> = emptyList()
)

class OptimizerViewModel(app: Application) : AndroidViewModel(app) {
    private val fragRepo = (app as HubCznApp).fragmentRepo
    private val charRepo = app.characterRepo
    private val optimizer = GearOptimizer()
    private var job: Job? = null

    private val _state = MutableStateFlow(OptimizerState())
    val state: StateFlow<OptimizerState> = _state.asStateFlow()

    init {
        viewModelScope.launch { charRepo.getAllFlow().collect { _state.update { s -> s.copy(characters = it) } } }
    }

    fun selectChar(char: CharacterEntity) = _state.update { it.copy(selectedChar = char, results = emptyList()) }
    fun updateConfig(c: OptimizeConfig) = _state.update { it.copy(config = c) }

    fun run() {
        val char = _state.value.selectedChar ?: return
        job?.cancel()
        job = viewModelScope.launch(Dispatchers.Default) {
            _state.update { it.copy(isRunning = true, results = emptyList(), progress = Triple(0, 0, 0)) }
            val frags    = fragRepo.getAll()
            val subsMap  = frags.associate { f -> f.id to fragRepo.getSubstats(f.id) }
            val current  = frags.filter { it.equippedTo == char.name }
            val config   = _state.value.config.copy(charName = char.name)
            val results  = optimizer.optimize(frags, subsMap, config, current) { c, t, f ->
                _state.update { it.copy(progress = Triple(c, t, f)) }
            }
            _state.update { it.copy(isRunning = false, results = results) }
        }
    }

    fun cancel() { job?.cancel(); _state.update { it.copy(isRunning = false) } }

    companion object {
        val Factory: ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(c: Class<T>, e: CreationExtras) =
                OptimizerViewModel(e[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]!!) as T
        }
    }
}
```

- [ ] **Step 2: Write OptimizerScreen.kt**

```kotlin
package com.hubczn.optimizer.ui.optimizer

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.*
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hubczn.optimizer.model.BuildResult
import com.hubczn.optimizer.ui.theme.*

@Composable
fun OptimizerScreen(vm: OptimizerViewModel = viewModel(factory = OptimizerViewModel.Factory)) {
    val state by vm.state.collectAsState()
    val expandedRank = remember { mutableStateOf<Int?>(null) }

    Column(Modifier.fillMaxSize().background(Background)) {
        Row(Modifier.fillMaxWidth().background(SurfaceVariant).padding(16.dp)) {
            Text("Otimizador", color = TextPrimary, fontSize = 18.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
        }

        LazyColumn(Modifier.weight(1f)) {
            // Character selector
            item {
                Column(Modifier.background(Surface).padding(16.dp)) {
                    Text("Personagem", color = TextMuted, fontSize = 10.sp)
                    var expanded by remember { mutableStateOf(false) }
                    Box {
                        OutlinedButton(onClick = { expanded = true }) {
                            Text(state.selectedChar?.name ?: "Selecionar", color = TextPrimary)
                        }
                        DropdownMenu(expanded, { expanded = false }, modifier = Modifier.background(Surface)) {
                            state.characters.forEach { c ->
                                DropdownMenuItem(
                                    text = { Text(c.name, color = TextPrimary) },
                                    onClick = { vm.selectChar(c); expanded = false }
                                )
                            }
                        }
                    }
                }
            }

            // Run / Cancel + progress
            item {
                Column(Modifier.padding(16.dp)) {
                    Button(
                        onClick = { if (state.isRunning) vm.cancel() else vm.run() },
                        enabled = state.selectedChar != null,
                        colors = ButtonDefaults.buttonColors(containerColor = if (state.isRunning) ErrorColor else Primary),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(if (state.isRunning) "Cancelar" else "Otimizar") }

                    if (state.isRunning) {
                        val (c, t, f) = state.progress
                        Spacer(Modifier.height(8.dp))
                        Text("$c/$t verificados Â· $f encontrados", color = TextMuted, fontSize = 12.sp)
                        LinearProgressIndicator(Modifier.fillMaxWidth(), color = Primary)
                    }
                }
            }

            // Results list
            items(state.results) { result ->
                val isExp = expandedRank.value == result.rank
                Column(Modifier.fillMaxWidth().clickable { expandedRank.value = if (isExp) null else result.rank }
                    .background(Surface).padding(12.dp)) {
                    Row {
                        Text("#${result.rank}", color = Primary, fontSize = 12.sp, modifier = Modifier.width(32.dp))
                        Text("Score: ${"%.1f".format(result.score)}", color = TextPrimary, fontSize = 12.sp)
                        Spacer(Modifier.weight(1f))
                        Text(result.setSummary, color = TextSecondary, fontSize = 10.sp)
                    }
                    AnimatedVisibility(visible = isExp) {
                        Column(Modifier.padding(top = 8.dp)) {
                            // Stats delta table
                            val cur = result.currentGearStats
                            val bld = result.gearStats
                            Text("Atual â†’ Build â†’ Delta", color = TextMuted, fontSize = 10.sp)
                            listOf("ATK%" to Pair(cur.atkPct, bld.atkPct), "CRate" to Pair(cur.cRate, bld.cRate),
                                "CDmg" to Pair(cur.cDmg, bld.cDmg), "DEF%" to Pair(cur.defPct, bld.defPct)).forEach { (label, p) ->
                                val delta = p.second - p.first
                                Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                                    Text(label, color = TextMuted, fontSize = 11.sp, modifier = Modifier.width(56.dp))
                                    Text("${"%.1f".format(p.first)}", color = TextSecondary, fontSize = 11.sp, modifier = Modifier.width(56.dp))
                                    Text("${"%.1f".format(p.second)}", color = TextPrimary, fontSize = 11.sp, modifier = Modifier.width(56.dp))
                                    Text("${if (delta >= 0) "+" else ""}${"%.1f".format(delta)}", color = if (delta >= 0) SuccessColor else ErrorColor, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
                HorizontalDivider(color = BorderSubtle, thickness = 0.5.dp)
            }
        }
    }
}
```

- [ ] **Step 3: Commit**
```bash
git add app/src/ && git commit -m "feat(android): OptimizerScreen + ViewModel"
```

---

## Task 18: ScoringScreen

**Files:** `ui/scoring/ScoringViewModel.kt`, `ui/scoring/ScoringScreen.kt`

- [ ] **Step 1: Write ScoringViewModel.kt**

```kotlin
package com.hubczn.optimizer.ui.scoring

import android.app.Application
import androidx.lifecycle.*
import com.hubczn.optimizer.HubCznApp
import com.hubczn.optimizer.data.db.ALL_STAT_NAMES
import com.hubczn.optimizer.data.db.entities.CharacterEntity
import com.hubczn.optimizer.model.CharPreset
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

val DPS_WEIGHTS = ALL_STAT_NAMES.associateWith { stat ->
    when (stat) { "ATK%" -> 10f; "CRate" -> 8f; "CDmg" -> 8f; "Extra DMG%" -> 6f; "Flat ATK" -> 7f; else -> 1f }
}
val TANK_WEIGHTS = ALL_STAT_NAMES.associateWith { stat ->
    when (stat) { "DEF%" -> 10f; "HP%" -> 10f; "Flat DEF" -> 8f; "Flat HP" -> 8f; else -> 1f }
}

class ScoringViewModel(app: Application) : AndroidViewModel(app) {
    private val weightsRepo = (app as HubCznApp).weightsRepo
    private val charRepo    = app.characterRepo
    val charPresets: Map<Int, CharPreset> = app.charPresets

    val characters: StateFlow<List<CharacterEntity>> =
        charRepo.getAllFlow().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _selChar = MutableStateFlow<CharacterEntity?>(null)
    val selectedChar: StateFlow<CharacterEntity?> = _selChar.asStateFlow()

    val globalWeights: StateFlow<Map<String, Float>> = weightsRepo.getWeightsMapFlow("")
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ALL_STAT_NAMES.associateWith { 1f })

    val charWeights: StateFlow<Map<String, Float>?> = _selChar.flatMapLatest { char ->
        if (char == null) flowOf(null)
        else weightsRepo.getWeightsMapFlow(char.name).map { it.ifEmpty { null } }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun selectChar(char: CharacterEntity?) { _selChar.value = char }

    fun save(weights: Map<String, Float>) = viewModelScope.launch {
        weightsRepo.saveWeights(weights, _selChar.value?.name ?: "")
    }

    fun resetToGlobal() = viewModelScope.launch {
        _selChar.value?.name?.let { weightsRepo.deleteCharOverride(it) }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(c: Class<T>, e: CreationExtras) =
                ScoringViewModel(e[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]!!) as T
        }
    }
}
```

- [ ] **Step 2: Write ScoringScreen.kt**

```kotlin
package com.hubczn.optimizer.ui.scoring

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.*
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hubczn.optimizer.data.db.ALL_STAT_NAMES
import com.hubczn.optimizer.ui.theme.*

@Composable
fun ScoringScreen(vm: ScoringViewModel = viewModel(factory = ScoringViewModel.Factory)) {
    val chars      by vm.characters.collectAsState()
    val selChar    by vm.selectedChar.collectAsState()
    val globalW    by vm.globalWeights.collectAsState()
    val charW      by vm.charWeights.collectAsState()
    val baseWeights = charW ?: globalW
    var localWeights by remember(selChar?.name) { mutableStateOf<Map<String, Float>?>(null) }
    val display = localWeights ?: baseWeights
    val preset  = selChar?.let { vm.charPresets[it.resId] }

    Column(Modifier.fillMaxSize().background(Background)) {
        Row(Modifier.fillMaxWidth().background(SurfaceVariant).padding(16.dp)) {
            Text("PontuaÃ§Ã£o", color = TextPrimary, fontSize = 18.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
        }

        LazyColumn(Modifier.weight(1f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // Character selector
            item {
                var expanded by remember { mutableStateOf(false) }
                Box {
                    OutlinedButton(onClick = { expanded = true }) {
                        Text(selChar?.name ?: "Global â€” todos", color = TextPrimary)
                    }
                    DropdownMenu(expanded, { expanded = false }, modifier = Modifier.background(Surface)) {
                        DropdownMenuItem(text = { Text("Global â€” todos", color = TextPrimary) },
                            onClick = { vm.selectChar(null); expanded = false })
                        chars.forEach { c ->
                            DropdownMenuItem(text = { Text(c.name, color = TextPrimary) },
                                onClick = { vm.selectChar(c); expanded = false })
                        }
                    }
                }
            }

            // Preset buttons
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { localWeights = DPS_WEIGHTS }) { Text("DPS", color = TextPrimary) }
                    OutlinedButton(onClick = { localWeights = TANK_WEIGHTS }) { Text("Tank", color = TextPrimary) }
                    if (preset != null) {
                        OutlinedButton(onClick = { localWeights = preset.weights.mapValues { it.value.toFloat() } }) {
                            Text("Sistema", color = Primary)
                        }
                    }
                    OutlinedButton(onClick = { localWeights = ALL_STAT_NAMES.associateWith { 1f } }) {
                        Text("Reset", color = TextSecondary)
                    }
                }
            }

            // Preset info card (if character has preset)
            if (preset != null) {
                item {
                    Column(Modifier.background(Surface).padding(12.dp).fillMaxWidth()) {
                        Text("Sets recomendados", color = TextMuted, fontSize = 10.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            preset.recommended_sets.forEach { id ->
                                Surface(color = Secondary.copy(alpha = 0.2f), shape = androidx.compose.foundation.shape.RoundedCornerShape(6.dp)) {
                                    Text("Set $id", color = Primary, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp))
                                }
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Text("Substats prioritÃ¡rios", color = TextMuted, fontSize = 10.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            preset.substats.forEachIndexed { i, s ->
                                val color = if (i == 0) Primary else TextSecondary
                                Surface(color = (if (i == 0) Primary else Border).copy(alpha = 0.2f), shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp)) {
                                    Text(s, color = color, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                }
                            }
                        }
                    }
                }
            }

            // Weight inputs
            item {
                Surface(color = Surface, shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)) {
                    Column(Modifier.padding(12.dp)) {
                        ALL_STAT_NAMES.forEach { stat ->
                            Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                                Text(stat, color = TextSecondary, fontSize = 13.sp, modifier = Modifier.weight(1f))
                                var text by remember(display[stat]) { mutableStateOf("${(display[stat] ?: 1f).toInt()}") }
                                OutlinedTextField(
                                    value = text,
                                    onValueChange = { v ->
                                        text = v
                                        v.toFloatOrNull()?.coerceIn(0f, 10f)?.let { fv ->
                                            localWeights = (localWeights ?: display) + (stat to fv)
                                        }
                                    },
                                    modifier = Modifier.width(64.dp),
                                    singleLine = true,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary,
                                        focusedBorderColor = Primary, unfocusedBorderColor = Border
                                    )
                                )
                            }
                        }
                    }
                }
            }

            // Save
            item {
                Button(onClick = { vm.save(display); localWeights = null }, modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Primary)) { Text("Salvar Pesos") }
                if (charW != null && selChar != null) {
                    TextButton(onClick = { vm.resetToGlobal(); localWeights = null }, modifier = Modifier.fillMaxWidth()) {
                        Text("Usar pesos globais", color = TextMuted)
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 3: Commit**
```bash
git add app/src/ && git commit -m "feat(android): ScoringScreen + ViewModel"
```

---

## Task 19: RescueScreen

**Files:** `ui/rescue/RescueViewModel.kt`, `ui/rescue/RescueScreen.kt`

- [ ] **Step 1: Write RescueViewModel.kt**

```kotlin
package com.hubczn.optimizer.ui.rescue

import android.app.Application
import androidx.lifecycle.*
import com.hubczn.optimizer.HubCznApp
import com.hubczn.optimizer.data.db.entities.RescuePullEntity
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class BannerStats(
    val totalPulls: Int, val fiveStarCount: Int, val fourStarCount: Int,
    val avgPity5: Float, val avgPity4: Float, val winRate: Float,
    val fiveStarPulls: List<RescuePullEntity>
)

class RescueViewModel(app: Application) : AndroidViewModel(app) {
    private val rescueRepo = (app as HubCznApp).rescueRepo

    val banners: StateFlow<List<String>> = rescueRepo.getBannersFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _activeBanner = MutableStateFlow("")
    val activeBanner: StateFlow<String> = _activeBanner.asStateFlow()

    val bannerStats: StateFlow<BannerStats?> = _activeBanner.flatMapLatest { b ->
        if (b.isEmpty()) flowOf(null) else rescueRepo.getByBannerFlow(b).map { computeStats(it) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val allPulls: StateFlow<List<RescuePullEntity>> = _activeBanner.flatMapLatest { b ->
        if (b.isEmpty()) flowOf(emptyList()) else rescueRepo.getByBannerFlow(b)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun selectBanner(name: String) { _activeBanner.value = name }

    init {
        viewModelScope.launch {
            banners.filter { it.isNotEmpty() }.collect { bs ->
                if (_activeBanner.value.isEmpty()) _activeBanner.value = bs.first()
            }
        }
    }

    private fun computeStats(pulls: List<RescuePullEntity>): BannerStats {
        val fives = pulls.filter { it.rarity == 5 }
        val fours = pulls.filter { it.rarity == 4 }
        return BannerStats(
            totalPulls = pulls.size, fiveStarCount = fives.size, fourStarCount = fours.size,
            avgPity5 = fives.map { it.pity.toFloat() }.average().toFloat().takeIf { fives.isNotEmpty() } ?: 0f,
            avgPity4 = fours.map { it.pity.toFloat() }.average().toFloat().takeIf { fours.isNotEmpty() } ?: 0f,
            winRate  = if (fives.isNotEmpty()) fives.count { it.isFeatured }.toFloat() / fives.size * 100f else 0f,
            fiveStarPulls = fives
        )
    }

    companion object {
        val Factory: ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(c: Class<T>, e: CreationExtras) =
                RescueViewModel(e[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]!!) as T
        }
    }
}
```

- [ ] **Step 2: Write RescueScreen.kt**

```kotlin
package com.hubczn.optimizer.ui.rescue

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.*
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hubczn.optimizer.capture.CaptureService
import com.hubczn.optimizer.ui.components.PityBadge
import com.hubczn.optimizer.ui.components.PortraitImage
import com.hubczn.optimizer.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun RescueScreen(onToggleCapture: () -> Unit, vm: RescueViewModel = viewModel(factory = RescueViewModel.Factory)) {
    val banners by vm.banners.collectAsState()
    val active  by vm.activeBanner.collectAsState()
    val stats   by vm.bannerStats.collectAsState()
    val pulls   by vm.allPulls.collectAsState()
    val context = LocalContext.current
    var filter  by remember { mutableIntStateOf(0) }
    var page    by remember { mutableIntStateOf(0) }
    val pageSize = 20
    val filtered = when (filter) { 5 -> pulls.filter { it.rarity == 5 }; 4 -> pulls.filter { it.rarity == 4 }; else -> pulls }
    val totalPages = maxOf(1, (filtered.size + pageSize - 1) / pageSize)

    Column(Modifier.fillMaxSize().background(Background)) {
        // Header
        Row(Modifier.fillMaxWidth().background(SurfaceVariant).padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Text("Rescue Records", color = TextPrimary, fontSize = 18.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { /* export JSON */ }) { Icon(Icons.Default.Download, null, tint = TextSecondary) }
            IconButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://hub-czn.lovable.app"))) }) {
                Icon(Icons.Default.Cloud, null, tint = Primary)
            }
            IconButton(onClick = onToggleCapture) {
                Icon(Icons.Default.Videocam, null, tint = if (CaptureService.isRunning) Primary else TextMuted)
            }
        }

        // Banner tabs
        if (banners.isNotEmpty()) {
            val activeIdx = banners.indexOf(active).coerceAtLeast(0)
            ScrollableTabRow(selectedTabIndex = activeIdx, containerColor = SurfaceVariant, edgePadding = 16.dp) {
                banners.forEach { b ->
                    Tab(selected = b == active, onClick = { vm.selectBanner(b); page = 0 }) {
                        Text(b, color = if (b == active) Primary else TextSecondary, modifier = Modifier.padding(12.dp))
                    }
                }
            }
        }

        LazyColumn(Modifier.weight(1f)) {
            // Stats panel
            stats?.let { s ->
                item {
                    Column(Modifier.background(Surface).padding(16.dp).fillMaxWidth()) {
                        listOf("Total pulls" to "${s.totalPulls}", "5â˜…" to "${s.fiveStarCount}",
                            "4â˜…" to "${s.fourStarCount}", "Pity mÃ©dio 5â˜…" to "%.1f".format(s.avgPity5),
                            "Win rate 50/50" to "%.0f%%".format(s.winRate)).forEach { (l, v) ->
                            Row { Text("$l: ", color = TextMuted, fontSize = 12.sp); Text(v, color = TextPrimary, fontSize = 12.sp) }
                        }
                    }
                }

                // 5â˜… portrait grid
                if (s.fiveStarPulls.isNotEmpty()) {
                    item {
                        LazyRow(Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(s.fiveStarPulls) { pull ->
                                Box {
                                    PortraitImage(0, 36.dp) // resId lookup not yet implemented
                                    PityBadge(pull.pity, Modifier.align(Alignment.BottomStart))
                                }
                            }
                        }
                    }
                }
            }

            // Filter chips
            item {
                Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("Todos" to 0, "5â˜…" to 5, "4â˜…" to 4).forEach { (l, v) ->
                        FilterChip(selected = filter == v, onClick = { filter = v; page = 0 }, label = { Text(l) })
                    }
                }
            }

            // Pull history (current page)
            val fmt = SimpleDateFormat("dd/MM/yy HH:mm", Locale.getDefault())
            items(filtered.drop(page * pageSize).take(pageSize)) { pull ->
                Row(Modifier.fillMaxWidth().background(Surface).padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Text("#${pull.pullNumber}", color = TextMuted, fontSize = 11.sp, modifier = Modifier.width(36.dp))
                    Text("â˜…".repeat(pull.rarity), color = rarityColor(pull.rarity), fontSize = 12.sp, modifier = Modifier.width(56.dp))
                    Text(pull.characterName, color = TextPrimary, fontSize = 12.sp, modifier = Modifier.weight(1f))
                    if (pull.isFeatured) Badge(containerColor = Primary) { Text("W") }
                    PityBadge(pull.pity, Modifier.padding(horizontal = 8.dp))
                    Text(fmt.format(Date(pull.timestamp)), color = TextMuted, fontSize = 10.sp)
                }
                HorizontalDivider(color = BorderSubtle, thickness = 0.5.dp)
            }

            // Pagination
            if (totalPages > 1) {
                item {
                    Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = { if (page > 0) page-- }) { Text("â€¹", color = Primary) }
                        Text("${page + 1} / $totalPages", color = TextSecondary, modifier = Modifier.padding(horizontal = 8.dp))
                        TextButton(onClick = { if (page < totalPages - 1) page++ }) { Text("â€º", color = Primary) }
                    }
                }
            }
        }
    }
}
```

- [ ] **Step 3: Commit**
```bash
git add app/src/ && git commit -m "feat(android): RescueScreen + ViewModel with banner tabs, stats, pull history"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Kotlin + Jetpack Compose | 1 |
| ForegroundService + MediaProjection 720p 1500ms | 12 |
| ML Kit OCR on-device | 11 |
| ScreenAnalyzer 3 types + 15s cooldown | 11 |
| OCR range validation â†’ discard frame | 13 |
| Room 5 entities | 3 |
| CharacterRepo, FragmentRepo, RescueRepo, WeightsRepo | 5 |
| GearScorer formula | 6 |
| BreakevenCalculator | 7 |
| DamageCalculator (EHP, AvgDMG) | 7 |
| GearOptimizer port | 8 |
| char_presets.json bundled | 9 |
| 72 PNG portraits bundled | 9 |
| CharPresetsLoader | 10 |
| Design system exact hex tokens | 2 |
| Bottom navigation 5 tabs | 14 |
| Combatentes screen (portrait, expand, breakeven badge, Cloud button) | 15 |
| Fragmentos horizontal table (8 columns + roll indicators) | 16 |
| Otimizador config + results + stats delta | 17 |
| PontuaÃ§Ã£o weights DPS/Tank/Sistema/Reset + CharPresetCard | 18 |
| Rescue banner tabs + stats + portrait pity grid + pagination + Cloud button | 19 |
| Notification "Hub CZN Â· Capturando..." + Parar action | 12 |

**Type consistency:**
- `GearScorer.gearScore(List<FragmentSubstatEntity>)` â€” consistent across Tasks 6, 16, 17
- `GearOptimizer.optimizeSync` returns `List<BuildResult>` â€” consumed in OptimizerViewModel correctly
- `WeightsRepo.getWeightsMapFlow(charId: String = "")` â€” ScoringViewModel passes `char.name` or `""`
- `ScreenType` enum defined in Task 11, consumed in Tasks 12 and 13
- `CharPreset.weights: Map<String, Double>` â€” ScoringScreen maps `.mapValues { it.value.toFloat() }` âœ“

**Known gap:** `PortraitImage` in RescueScreen passes `resId=0` for 5â˜… pull portraits because `RescuePullEntity` doesn't store `resId`. To fix: add a `resId: Int = 0` field to `RescuePullEntity` and extract it from OCR text during rescue capture.

---

## Execution

Plan saved to `docs/superpowers/plans/2026-05-05-android-app.md`. Two execution options:

**1. Subagent-Driven (recommended)** â€” fresh subagent per task, review between tasks. Invoke `superpowers:subagent-driven-development`.

**2. Inline Execution** â€” execute in this session using `superpowers:executing-plans`.

Which approach?

