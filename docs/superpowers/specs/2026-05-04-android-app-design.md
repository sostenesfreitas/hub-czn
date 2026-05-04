# Hub CZN Android — Design Spec

**Date:** 2026-05-04  
**Status:** Approved  
**Scope:** Native Android companion app with automatic screen capture via MediaProjection

---

## 1. Overview

A standalone Android app (Kotlin + Jetpack Compose) that replicates the 5 core features of the Hub CZN desktop app. It runs a background screen capture service that automatically detects and extracts game data via OCR, eliminating manual data entry. The app targets mobile-only players who have no PC.

**5 features in scope:**
1. Combatentes — character roster with stats and gear
2. Fragmentos — memory fragment inventory
3. Otimizador — gear build optimizer
4. Pontuação — stat weight configuration
5. Rescue Records — pull history and pity tracker

---

## 2. Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Language | Kotlin |
| UI | Jetpack Compose |
| Navigation | Compose NavHost + Bottom Navigation (5 tabs) |
| Background capture | `ForegroundService` + `MediaProjection` + `VirtualDisplay` |
| OCR | Google ML Kit Text Recognition v2 (on-device, offline) |
| Database | Room (SQLite) |
| Business logic | Pure Kotlin (ports of Python formulas) |
| Concurrency | Kotlin Coroutines + Flow |

### Project Structure

```
app/src/main/
├── capture/
│   ├── CaptureService.kt        — ForegroundService, manages MediaProjection lifecycle
│   ├── ScreenAnalyzer.kt        — detects screen type from OCR text blocks
│   └── OcrProcessor.kt          — ML Kit wrapper, returns TextBlock list
├── data/
│   ├── db/
│   │   ├── AppDatabase.kt
│   │   ├── entities/             — Character, Fragment, FragmentSubstat, RescuePull, ScoreWeight
│   │   └── daos/
│   └── repository/               — CharacterRepo, FragmentRepo, RescueRepo, WeightsRepo
├── logic/
│   ├── GearOptimizer.kt         — ports api/routes/optimize.py
│   ├── GearScorer.kt            — gear score formula
│   └── BreakevenCalculator.kt   — breakeven_delta = cdmg - (2*crate + 100)
├── ui/
│   ├── theme/                   — colors, typography (matches desktop design system)
│   ├── combatants/
│   ├── fragments/
│   ├── optimizer/
│   ├── scoring/
│   └── rescue/
└── MainActivity.kt
```

---

## 3. Design System

Mirrors the desktop app exactly.

| Token | Value |
|---|---|
| Background | `#0E0E0E` |
| Surface (cards) | `#181818` |
| Surface variant | `#121212` (headers, nav bar) |
| Border | `#282828` |
| Border subtle | `#1E1E1E` |
| Primary accent | `#C084FC` (purple) |
| Secondary accent | `#8B5CF6` |
| Text primary | `#FFFFFF` |
| Text secondary | `#B3B3B3` |
| Text muted | `#888888` |
| Error | `#F3727F` |
| Success | `#86EFAC` |

**Rarity colors:**
- 4★ (Legendary): `#C084FC`
- 3★ (Rare): `#3B82F6`
- 2★ (Uncommon): `#84CC16`
- 1★ (Common): `#A8A29E`

**Pity color scale:**
- 0–25: `#86EFAC` (green)
- 26–50: `#FBBF24` (yellow)
- 51–65: `#FB923C` (orange)
- 66+: `#F87171` (red)

**Card shape:** `RoundedCornerShape(12.dp)` for main cards, `8.dp` for compact cards  
**Spacing unit:** 4dp grid

---

## 4. Background Capture Service

### CaptureService (ForegroundService)

- Starts when user taps "Iniciar captura" from any tab
- Requests `MediaProjection` permission (system dialog, once)
- Creates a `VirtualDisplay` at 720p
- Runs `ScreenAnalyzer` on a coroutine every **1500ms**
- Displays a persistent notification: "Hub CZN · Capturando..." with a "Parar" action
- Stops when user taps "Parar" in the notification or from within the app

### ScreenAnalyzer

Receives the Bitmap frame, runs ML Kit OCR, and returns a `ScreenType`:

```kotlin
enum class ScreenType { CHAR_STATS, MEMORY_FRAGMENT, RESCUE_RESULT, UNKNOWN }
```

**Detection signatures (all keywords must be present):**

| ScreenType | Required keywords |
|---|---|
| `CHAR_STATS` | "CRIT RATE", "CRIT DMG", "ATK", "DEF" |
| `MEMORY_FRAGMENT` | "MEMORY FRAGMENT", "GEAR SCORE" |
| `RESCUE_RESULT` | "RESCUE" + (★★★★★ or ★★★★) |

If no signature matches → `UNKNOWN` → frame discarded, no action.

### Deduplication

After successfully saving data from a `ScreenType`, that type enters a **15-second cooldown**. During cooldown, new frames of the same type are ignored. The cooldown resets if a different `ScreenType` is detected in between.

### OCR Validation

Before persisting any extracted value, range checks are applied:

| Field | Valid range |
|---|---|
| ATK | 100 – 99,999 |
| DEF | 50 – 99,999 |
| HP | 1,000 – 999,999 |
| CRate | 0 – 100 |
| CDmg | 100 – 400 |
| Gear Score | 0 – 100 |
| Roll count | 1 – 4 |
| Pity | 1 – 70 |

If any field fails validation → entire frame discarded silently. The next 1500ms cycle retries.

---

## 5. Screens

### 5.1 Combatentes

**Data source:** OCR of character stats screen → `CHAR_STATS`  
**Fields extracted:** character name, ATK, DEF, HP, CRate, CDmg (from stats screen)  
**Fields stored additionally:** partner name (from screen), capture timestamp

**UI:**
- Header: title "Combatentes" + badge with count + "↓ JSON" button (exports local Room data) + "☁ Cloud" button (opens `https://hub-czn.lovable.app` via `Intent.ACTION_VIEW`)
- Scrollable list of combatant rows, each showing:
  - Rank (1-based index)
  - Character portrait: `res_id`-based image bundled in APK assets (`game/faces/bookmark_face_character_map_{res_id}.png`). 72 PNGs, 896KB total. Same files already in `api/assets/game/faces/`.
  - Name + "Lv.{level}" + attribute badge + ego badge (if E > 0)
  - Gear Score (right-aligned, purple)
  - Expand chevron
- **Expanded row** shows (inline, below the row):
  - Partner badge (icon + "PARTNER" label + name), if present
  - Final stats grid (2 columns): ATK, DEF, HP, CRate, CDmg, EHP, AvgDMG, Ego
  - Gear slot grid (6 slots, progressive opacity: 0.72 / 0.86 / 1.0)

**Computed fields (Kotlin):**
- `EHP = HP × (1 + DEF / 300)`
- `AvgDMG = ATK × (CRate/100 × CDmg/100 + (1 - CRate/100))`
- `GS` = gear score from fragments (average across equipped slots)
- `breakeven_delta = CDmg - (2 × CRate + 100)` → shown as warning badge if > 30

### 5.2 Fragmentos

**Data source:** OCR of Memory Fragment detail screen → `MEMORY_FRAGMENT`  
**Fields extracted:** slot number, rarity, level, set name, main stat name + value, substats (name + value + roll count)

**UI:**
- Header: "Fragmentos" + count badge
- **Horizontally scrollable table** (same structure as desktop):

| Column | Format |
|---|---|
| Slot | numeric |
| Set | colored text (rarity color) |
| Lv | `+{level}` |
| Main Stat | stat name + value |
| Sub 1–4 | `{name} {rolls} {value}` or `—` |
| GS | `.1f`, purple monospace |
| Potential | `{low}–{high}` |
| Equipado | character name or `—` |

- Roll indicators: `›` = 1 roll, `››` = 2 rolls, `›››` = 3 rolls, `††††` = 4 rolls (purple if multiple)

**Gear Score formula (Kotlin):**
```
GS = Σ( value / (maxRoll × rollCount) × rollCount ) × 10
```

### 5.3 Otimizador

**Data source:** uses Combatentes and Fragmentos data already stored in Room  
**No OCR needed**

**UI — Configuration panel (scrollable):**
- Character selector (dropdown of captured characters)
- 4-piece set selector (single select, from sets present in Fragment inventory)
- 2-piece sets selector (multi-select, max 3)
- Main stat selectors: slot 4, 5, 6 (dropdowns with valid options per slot)
- Stat priorities: number inputs for each stat, range –1 to 3 (same scale as desktop)
- Filters: Top % (1–100), Max results (1–50), Include equipped (checkbox)
- **Run button** → triggers `GearOptimizer` on a background coroutine

**UI — Results area:**
- While running: progress indicator `{checked}/{total} checked · {found} found`
- Results list: rank, score, set summary, ATK, CRate, CDmg, EHP
- Expandable result row shows:
  - Stats comparison table: Atual vs Build vs Delta (colored)
  - Gear pieces grid (6 slots)

**GearOptimizer (Kotlin):**  
Port of `api/routes/optimize.py`. Enumerate valid gear combinations from Room inventory respecting set/main-stat constraints. Score each combination using the configured weights. Return top N results sorted by score descending.

### 5.4 Pontuação

**Data source:** user input only — no OCR  
**Persisted in:** Room `ScoreWeight` table (global weights + per-character overrides)

**UI:**
- Character selector: "Global — todos os personagens" + list of captured characters
- Preset buttons: DPS, Tank, Sistema (from game data per character), Reset
- When a character is selected and has a game preset:
  - Recommended sets (badge list)
  - Main stats per slot (4/5/6)
  - Recommended substats (badge list, primary substat highlighted in purple)
- Game presets come from `Vribbels/game_data/char_presets.py` (9KB static file). Before building the Android app, export this to `assets/char_presets.json` and load it at runtime via `assets` folder — no network call needed.
- Weight inputs: one row per stat, label + number input (0–10)
- Save button → persists to Room; recomputes GS for all fragments equipped to that character

**Preset values (same as desktop):**
```
DPS:  ATK%=10, CRate=8, CDmg=8, ExtraDMG%=6, FlatATK=7, rest=1
Tank: DEF%=10, HP%=10, FlatDEF=8, FlatHP=8, rest=1
```

### 5.5 Rescue Records

**Data source:** OCR of rescue result screen → `RESCUE_RESULT`  
**Fields extracted:** character name, rarity (★ count), pity count, banner name, featured status, timestamp

**UI:**
- Header: "Rescue Records" + "↓ JSON" button (exports local Room data) + "☁ Cloud" button (opens `https://hub-czn.lovable.app` via `Intent.ACTION_VIEW`)
- **Banner tabs** (horizontal scroll): one tab per banner name, active tab has purple underline
- **Stats panel** (active banner):
  - Left: stat rows — total pulls, recursos gastos, 5★ count, 4★ count, pity médio 5★, pity médio 4★, win rate 50/50
  - Right: donut chart (Compose Canvas) — 5★ / 4★ / 3★ distribution, colors: `#C084FC` / `#8B5CF6` / `#B3B3B3`
- **5★ portrait grid**: horizontal row of 36×36dp character portrait images (same bundled assets as Combatentes), each showing pity number (bottom-left, color-coded by pity scale)
- **Filter buttons**: Todos / 5★ / 4★
- **Pull history table** (horizontal scroll):

| Column | Format |
|---|---|
| # | pull_number, monospace |
| Personagem | ★ count + name + Featured badge if applicable |
| Pity | numeric, pity color scale |
| Data | formatted datetime |

- Pagination: ‹ / page / total / › buttons

---

## 6. Data Models (Room Entities)

```kotlin
@Entity
data class Character(
    @PrimaryKey val name: String,
    val atk: Float, val def: Float, val hp: Float,
    val critRate: Float, val critDmg: Float,
    val partnerName: String?,
    val capturedAt: Long
)

@Entity
data class Fragment(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val slot: Int, val rarity: Int, val level: Int,
    val setName: String,
    val mainStatName: String, val mainStatValue: Float,
    val equippedTo: String?,
    val capturedAt: Long
)

@Entity
data class FragmentSubstat(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val fragmentId: Int,
    val name: String, val value: Float, val rollCount: Int
)

@Entity
data class RescuePull(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val bannerName: String,
    val pullNumber: Int,
    val characterName: String,
    val rarity: Int,
    val pity: Int,
    val isFeatured: Boolean,
    val timestamp: Long
)

@Entity
data class ScoreWeight(
    @PrimaryKey val statName: String,
    val weight: Float,           // 0–10
    val charOverride: String?    // null = global
)
```

---

## 7. Business Logic (Kotlin ports)

### BreakevenCalculator
```kotlin
fun breakevenDelta(crate: Float, cdmg: Float): Float = cdmg - (2 * crate + 100)
// positive → prioritize CRate; negative → prioritize CDmg
// |delta| > 30 → urgent warning
```

### GearScorer
```kotlin
val maxRolls = mapOf(
    "CRate" to 2.0f, "CDmg" to 4.0f,
    "ATK%" to 1.3f, "DEF%" to 1.3f, "HP%" to 1.3f,
    "Flat ATK" to 8f, "Flat DEF" to 5f, "Flat HP" to 12f,
    "Ego" to 5f, "Extra DMG%" to 3.4f
)

fun gearScore(substats: List<FragmentSubstat>): Float {
    return substats.sumOf { sub ->
        val max = maxRolls[sub.name] ?: return@sumOf 0.0
        (sub.value / (max * sub.rollCount) * sub.rollCount).toDouble()
    }.toFloat() * 10f
}
```

### DamageCalculator (for Otimizador stats comparison)
```kotlin
fun avgDmg(atk: Float, crate: Float, cdmg: Float, enemyDef: Float, morale: Int = 0): Float {
    val critFactor = (crate / 100f) * (cdmg / 100f) + (1f - crate / 100f)
    val defReduction = 300f / (300f + enemyDef)
    val moraleMult = 1f + morale * 0.20f
    return atk * critFactor * defReduction * moraleMult
}
```

---

## 8. Error Handling

| Scenario | Behavior |
|---|---|
| OCR field out of valid range | Discard frame silently; retry next cycle |
| Screen detected but OCR returns no text | Discard frame; retry next cycle |
| MediaProjection permission denied | Show in-app prompt explaining why permission is needed |
| `CaptureService` killed by OS | Notification disappears; user can restart from any tab |
| Room write failure | Log to Logcat; show snackbar "Erro ao salvar dados" |
| GearOptimizer — no results found | Show "Nenhuma build encontrada" state |

---

## 9. What is NOT in scope

- Cloud sync or backend server (100% offline)
- Battle overview / analytics tab (desktop-only feature)
- Simulator page (separate from Optimizer — not in mobile scope)
- Cards page
- Multiple profiles / account switching
- Push notifications
- iOS support
