# Android CZN Scanner v2 — Design Spec

Date: 2026-05-07

## Overview

A set of improvements to the CZN Scanner Android app covering: improved scan UX flow, local Room database with persistent history, character lookup table, desktop-compatible JSON export, internationalization (EN/PT-BR), folder selection, and a full Rescue Records history screen.

---

## 1. Visual Design

**Theme: Dark Ember**
- Background: `#0D0D1A`
- Surface/cards: `#1A1A2E`
- Border: `#2a2a4a`
- Accent/primary: `#E87A2D` (orange gradient to `#ff5722`)
- Text primary: `#FFFFFF`
- Text secondary: `#888888`
- 5★ gold: `#FFD700`
- 4★ purple: `#B39DDB`
- Cloud blue: `#7C9FE8`

---

## 2. Architecture — New Components

### New Files
| File | Purpose |
|------|---------|
| `data/local/ScanConfigStore.kt` | SharedPreferences wrapper — calibration, folder URI, language, last banner |
| `data/local/RescueRecordDatabase.kt` | Room DB definition |
| `data/local/RescueRecordEntity.kt` | Room entity with `duplicate_idx` composite unique key |
| `data/local/RescueRecordDao.kt` | DAO — upsert, query by banner, count duplicates |
| `data/repository/CharacterRepository.kt` | Loads `assets/characters.json`, provides name → `{res_id, rarity, kind}` lookup |
| `ui/components/ScanOptionsOverlay.kt` | Pre-scan floating overlay: banner picker, page limit, calibration status |
| `ui/HistoryActivity.kt` | Full-screen history screen — stats, 5★ grid, pull list |
| `assets/characters.json` | Bundled lookup: extracted from `characters.py` + `partners.py` |
| `res/values-pt/strings.xml` | PT-BR translations |

### Modified Files
| File | Change |
|------|--------|
| `ui/MainActivity.kt` | Dark Ember redesign, language toggle, SAF folder picker |
| `ui/components/FloatingOverlay.kt` | Add X close button, remove Cal > and language toggle |
| `data/repository/JSONExporter.kt` | Accept SAF `Uri?`, produce desktop-compatible format |
| `logic/RescueRecordScanner.kt` | Accept `pageLimit: Int?`, pass banner name |
| `capture/CaptureService.kt` | Read `ScanConfigStore`, pass config to scanners, trigger DB upsert |

---

## 3. Scan UX Flow

### FloatingOverlay (simplified)
```
┌─────────────────────┐
│ CZN ▼          [✕]  │  ← X stops CaptureService
├─────────────────────┤
│ 🎯 Rescue Records   │
│ 🧩 Memory Fragments │
│ ⚔️  Combatants       │
│ [status msg]        │
└─────────────────────┘
```

### ScanOptionsOverlay (opens on scan type tap)
```
┌─────────────────────────┐
│  🎯 Rescue Records  [✕] │
├─────────────────────────┤
│  BANNER                 │
│  ● Seasonal Combatant   │  ← default selected
│  ○ Gacha General        │
│  ○ Gacha Pickup Support │
├─────────────────────────┤
│  LIMITE DE PÁGINAS      │
│  [ ___ ]  vazio = ∞    │
├─────────────────────────┤
│  CALIBRAÇÃO             │
│  ✓ Salvo (1042, 1876)   │  [Recalibrar]
├─────────────────────────┤
│      [▶ INICIAR SCAN]   │
└─────────────────────────┘
```
Memory Fragments and Combatants show ScanOptionsOverlay without the banner section.

---

## 4. MainActivity Redesign

Dark Ember layout with:
- App logo + title area
- Permission cards (Overlay, Accessibility) with status badges
- Language toggle: `[EN] [PT-BR]` — saved to `ScanConfigStore`, applied via `AppCompatDelegate.setApplicationLocales()` (API 33+) with `LocaleHelper` fallback
- Output folder row: shows current path, `[Alterar]` opens `ACTION_OPEN_DOCUMENT_TREE`, URI persisted with `takePersistableUriPermission()`
- `[📊 Ver Histórico]` button — opens `HistoryActivity` (always visible if DB has records)
- `[▶ Iniciar Scanner]` button (only shown when all permissions granted)

---

## 5. Room Database

### RescueRecordEntity
```kotlin
@Entity(
  tableName = "rescue_records",
  indices = [Index(value = ["banner_name","name","type","create_at","rescue_type","is_featured","duplicate_idx"], unique = true)]
)
data class RescueRecordEntity(
  @PrimaryKey(autoGenerate = true) val id: Long = 0,
  val bannerName: String,
  val name: String,
  val type: String,          // "Partners" | "Combatants"
  val createAt: String,      // original string from OCR
  val rescueType: String,
  val isFeatured: Boolean,
  val duplicateIdx: Int,     // 0-based counter within same (bannerName,name,type,createAt,rescueType,isFeatured) group
  val resId: Int?,           // resolved from CharacterRepository
  val rarity: Int?,          // 3 | 4 | 5
  val pullNumber: Long       // auto-assigned: max(pullNumber)+1 per insert batch
)
```

### Deduplication strategy
On each record insert:
1. Query `COUNT(*)` WHERE all fields (except `id`, `duplicateIdx`, `pullNumber`) match
2. Use result as `duplicateIdx`
3. `INSERT OR IGNORE` — re-scanning same page is a no-op

### `pull_number` assignment
- After all pages are scanned, collect all new records (not yet in DB)
- Sort new records by `createAt` ascending, then by scan order (page × 5 + row) as tiebreaker
- Query current `MAX(pull_number)` from DB (0 if empty)
- Assign `pull_number = max + 1, max + 2, ...` in that sorted order
- Result: oldest record = lowest pull_number, newest = highest — matches desktop convention

---

## 6. Character Lookup (`assets/characters.json`)

Extracted from `api/game_data/characters.py` and `partners.py`:
```json
{
  "Akad":      { "res_id": 20007, "rarity": 4, "kind": "Partner" },
  "Heidemarie":{ "res_id": 1060,  "rarity": 5, "kind": "Combatant" },
  ...
}
```

`CharacterRepository` loads this at app start into an in-memory `Map<String, CharInfo>`.
Unknown names → `res_id = null`, `rarity = null` (tolerated; history still shows the record).

---

## 7. JSON Export (Desktop-Compatible Format)

`JSONExporter.exportRescueRecords()` queries Room DB and produces:
```json
[
  {
    "banner_name": "Seasonal Combatant Rescue Rate-Up",
    "pulls": [
      {
        "pull_number": 3246,
        "res_id": 20007,
        "name": "Akad",
        "rarity": 4,
        "kind": "Partner",
        "image_url": "/assets/game/faces/bookmark_face_character_map_20007.png",
        "pity": 7,
        "is_featured": false,
        "timestamp": 1777461416
      }
    ]
  }
]
```

**Pity calculation**: computed at export time by iterating records in `pull_number` order per banner, resetting counter on each `rarity = 5`.

**`createAt` → `timestamp`**: parse `"2026-04-29 08:16:56"` → unix seconds via `LocalDateTime` + `ZoneOffset.UTC`.

**Output destination**: SAF URI from `ScanConfigStore` if set; fallback to `Downloads/CZN-Scanner`.

---

## 8. History Screen (`HistoryActivity`)

Accessible from **MainActivity** via `[📊 Ver Histórico]` button.

### Sections
1. **Top bar**: title "Rescue Records" + `[⬇ Export JSON]` + `[☁ Save to Cloud]`
   - Save to Cloud: `Intent.ACTION_VIEW` → `https://hub-czn.lovable.app`
2. **Banner tabs**: Seasonal Combatant (default) | Gacha General | Gacha Pickup Supporter
3. **Stats card**: Total Pulls, Resources Spent (×160), 5★ count, 4★ count, Avg 5★ Pity, Avg 4★ Pity + donut chart
4. **Recent 5★ grid**: portrait images from `assets/faces/` with pity badge, horizontal wrap
5. **Filter row**: All / 5★ / 4★ chips + total count
6. **Pull list**: Roll#, portrait thumbnail, name + kind badge (green=Partner, red=Combatant), pity (orange/gold for 5★), date

### Assets
- Copy 72 PNGs from `api/assets/game/faces/` → `android-app/app/src/main/assets/faces/`
- Loaded via `BitmapFactory.decodeStream(assets.open("faces/bookmark_face_character_map_$resId.png"))`
- Unknown `res_id` → placeholder icon

---

## 9. Internationalization

- `res/values/strings.xml` — English (default)
- `res/values-pt/strings.xml` — Portuguese (Brazil)
- Language override stored in `ScanConfigStore.languageOverride` (`"en"` | `"pt"` | `null`)
- Applied in `MainActivity.onCreate()` before `setContent {}` via `AppCompatDelegate.setApplicationLocales()`
- Toggle in MainActivity: `[EN] [PT-BR]` buttons; selecting updates store and recreates activity

---

## 10. ScanConfigStore (SharedPreferences)

| Key | Type | Description |
|-----|------|-------------|
| `calib_x_rescue` | Float? | Next-page button X for Rescue Records |
| `calib_y_rescue` | Float? | Next-page button Y for Rescue Records |
| `calib_x_fragments` | Float? | Next-page button X for Memory Fragments |
| `calib_y_fragments` | Float? | Next-page button Y |
| `calib_x_combatants` | Float? | Next-page button X for Combatants |
| `calib_y_combatants` | Float? | Next-page button Y |
| `output_folder_uri` | String? | SAF URI string for export destination |
| `language_override` | String? | `"en"` \| `"pt"` \| null |
| `last_banner_index` | Int | 0=Seasonal, 1=General, 2=Pickup (default 0) |

---

## 11. Out of Scope (this iteration)

- Memory Fragments and Combatants database (Rescue Records only)
- Cloud sync / upload API integration
- Offline character data auto-update
