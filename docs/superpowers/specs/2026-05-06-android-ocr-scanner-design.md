# Android OCR Scanner — Design Spec

**Date:** 2026-05-06  
**Project:** Vribbels CZN-Optimizer  
**Module:** `android-app/`

---

## Overview

A native Android app that automatically scans Chaos Zero Nightmare game data via OCR, exporting JSON files compatible with the CZN-Optimizer desktop app.

The app overlays a floating button on top of the game. The user navigates to the correct in-game screen and presses the button — the app takes over navigation, captures all relevant screens, OCRs the data, and exports structured JSON.

**No root required. No APK modification. No network interception.**

---

## Tech Stack

| Component | Technology |
|---|---|
| Language | Kotlin |
| UI | Jetpack Compose |
| OCR | Google ML Kit Text Recognition v2 (on-device, offline) |
| Screenshots | MediaProjection API |
| Gestures | AccessibilityService |
| Serialization | kotlinx.serialization |
| Min SDK | 26 (Android 8.0) |

---

## Architecture

```
FloatingOverlay
    ↓ user triggers scan
CaptureService (ForegroundService)
    ├── ScreenshotManager (MediaProjection)
    ├── GestureDispatcher (AccessibilityService)
    └── MLKitOCREngine
            ↓ TextRecognitionResult (text + bounding boxes)
    ├── RescueRecordScanner
    ├── MemoryFragmentScanner
    └── CombatantScanner
            ↓ parsed data models
JSONExporter → /Downloads/CZN-Scanner/*.json
```

### Key principle

ML Kit returns each recognized text block with its **bounding box** (position on screen). Scanners use these positions to:
- Distinguish main stat (topmost in stats section) from substats
- Locate interactive elements (next page ">" button, item grid, nav tabs)
- Determine reading order and grouping

---

## Permissions

| Permission | Purpose |
|---|---|
| `SYSTEM_ALERT_WINDOW` | Floating overlay button |
| `FOREGROUND_SERVICE_MEDIA_PROJECTION` | Screenshot capture |
| `AccessibilityService` declaration | Gesture dispatch (tap, scroll) |

No dangerous runtime permissions beyond MediaProjection prompt (system dialog).

---

## Scan Flows

### Rescue Records

**Entry point:** User opens any banner → "Rescue Records" tab

```
screenshot → OCR table (5 rows/page)
    extract: Type, Name, Rescue Type, Timestamp
    detect: current page number, ">" button position
    simulate tap ">"
    wait for animation → screenshot → next page
    repeat until ">" is disabled or no new rows found
deduplicate by (name + timestamp)
save rescue_records_android_YYYYMMDD_HHMMSS.json
```

**Stop condition:** `>` button bounding box not found, or page number unchanged after tap.

---

### Memory Fragments

**Entry point:** User opens Memory Fragment inventory (grid view)

```
screenshot → detect grid items via bounding boxes
    tap first visible item → detail modal opens
    screenshot modal → OCR extracts:
        name, rarity badge, slot (roman numeral I–VI),
        upgrade level (+N), main stat, substats + roll counts
    tap ">" → next item
    repeat for all visible items
scroll down when last row reached
stop when no new items found after scroll
save memory_fragments_android_YYYYMMDD_HHMMSS.json
```

**Stop condition:** Full scroll produces no new item (same items as previous page).

---

### Combatants

**Entry point:** User opens character roster list

```
for each character thumbnail:
    tap character → navigate to "Stats" tab
    screenshot → OCR extracts:
        name, level/max_level, star count,
        Attack, Defense, Health, Critical Chance, Critical Damage
    tap "Memory Fragments" in left menu
    OCR detects equipped fragment slots (by slot position)
    record equipped_fragments list
    tap back → next character
save combatants_android_YYYYMMDD_HHMMSS.json
```

---

## Stat Parsing Rules

### Stat name + roll count

```
"Attack"          → name: "Attack",          extra_rolls: 0
"Health +2"       → name: "Health",          extra_rolls: 2
"Critical Chance" → name: "Critical Chance", extra_rolls: 0
```

Pattern: `^([A-Za-z\s]+?)(?:\s\+(\d+))?$`

### Stat value + type

```
"+22"   → value: 22,   type: flat
"1%"    → value: 1.0,  type: percent
"+31"   → value: 31,   type: flat
"2.6%"  → value: 2.6,  type: percent
"+1.6%" → value: 1.6,  type: percent
```

Pattern: `^\+?(\d+\.?\d*)(%?)$`

### Main stat vs substats

ML Kit does not return color information. Separation uses Y position:
- Stats section is identified by the divider line after the item image
- First stat entry (lowest Y coordinate in stats section) = **main stat**
- Remaining entries = **substats**

### Known stat names

```kotlin
val STAT_NAMES = setOf(
    "Attack", "Defense", "Health",
    "Critical Chance", "Critical Damage",
    "Speed", "Effect Hit Rate", "Effect Resistance"
)
```

Unknown stat names are stored as-is and flagged in the export for manual review.

### Rarity mapping

```kotlin
val RARITY_MAP = mapOf(
    "Legendary" to 5,
    "Epic"      to 4,
    "Rare"      to 3,
    "Uncommon"  to 2
)
```

### Slot mapping (Roman numerals)

```kotlin
val SLOT_MAP = mapOf(
    "I" to 1, "II" to 2, "III" to 3,
    "IV" to 4, "V" to 5, "VI" to 6
)
```

---

## Data Models

### MemoryFragment

```kotlin
data class MemoryFragment(
    val id: Int,                        // sequential, assigned during scan
    val slotNum: Int,                   // 1–6
    val setName: String,
    val rarity: String,                 // "Legendary", "Epic", etc.
    val rarityNum: Int,                 // 2–5
    val level: Int,                     // upgrade level (+0 to +12)
    val locked: Boolean,                // always false (OCR can't detect)
    val equippedCharName: String?,
    val statList: List<StatEntry>
)

data class StatEntry(
    val slot: Int,                      // 0 = main stat, 1–4 = substats
    val stat: String,
    val type: String,                   // "flat" or "percent"
    val value: Double,
    val extraRolls: Int                 // additional rolls beyond base
)
```

### RescueRecord

```kotlin
data class RescueRecord(
    val gachaId: String,               // inferred from banner name
    val bannerName: String,
    val type: String,                  // "Combatants" or "Partners"
    val name: String,
    val rescueType: String,
    val createAt: String,              // "YYYY-MM-DD HH:MM:SS"
    val isFeatured: Boolean            // true if name colored (orange/gold)
)
```

### Combatant

```kotlin
data class Combatant(
    val name: String,
    val level: Int,
    val maxLevel: Int,
    val stars: Int,
    val attack: Double,
    val defense: Double,
    val health: Double,
    val criticalChance: Double,
    val criticalDamage: Double,
    val equippedFragments: List<Int>   // fragment IDs by slot
)
```

---

## Export Format

Files saved to `/Downloads/CZN-Scanner/` and shared via Android share sheet.

### memory_fragments_android_YYYYMMDD_HHMMSS.json

```json
{
  "capture_time": "2026-05-06T15:30:45",
  "source": "android_ocr",
  "inventory": {
    "piece_items": [
      {
        "id": 1,
        "slot_num": 1,
        "set_name": "Healer's Journey",
        "rarity": "Legendary",
        "rarity_num": 5,
        "level": 5,
        "locked": false,
        "equipped_char_name": null,
        "stat_list": [
          { "slot": 0, "stat": "Attack", "type": "flat", "value": 22, "extra_rolls": 0 },
          { "slot": 1, "stat": "Health", "type": "percent", "value": 1.0, "extra_rolls": 0 },
          { "slot": 2, "stat": "Health", "type": "flat", "value": 31, "extra_rolls": 2 },
          { "slot": 3, "stat": "Attack", "type": "percent", "value": 2.6, "extra_rolls": 2 },
          { "slot": 4, "stat": "Critical Chance", "type": "percent", "value": 1.6, "extra_rolls": 0 }
        ]
      }
    ]
  },
  "characters": {
    "characters": [],
    "user": { "source": "android_ocr" }
  },
  "detected_region": "global"
}
```

### rescue_records_android_YYYYMMDD_HHMMSS.json

```json
{
  "capture_time": "2026-05-06T15:30:45",
  "source": "android_ocr",
  "source_key": "rescue_records",
  "records": [
    {
      "gacha_id": "pickup_combatant",
      "banner_name": "Amplified Distress Signal: Heidemarie",
      "type": "Combatants",
      "name": "Selena",
      "rescue_type": "Seasonal Combatant Rescue Rate-Up",
      "createAt": "2026-04-29 08:16:56",
      "is_featured": true
    }
  ]
}
```

### combatants_android_YYYYMMDD_HHMMSS.json

```json
{
  "capture_time": "2026-05-06T15:30:45",
  "source": "android_ocr",
  "combatants": [
    {
      "name": "Heidemarie",
      "level": 60,
      "max_level": 60,
      "stars": 5,
      "stats": {
        "attack": 1052,
        "defense": 184,
        "health": 514,
        "critical_chance": 36.8,
        "critical_damage": 237.0
      },
      "equipped_fragments": []
    }
  ]
}
```

---

## UI

### MainActivity — setup

- Checklist de permissões com status visual (✅/⬜)
- Botão para abrir configurações de cada permissão faltante
- Botão "Iniciar Scanner" ativo somente quando todas as permissões estão concedidas

### FloatingOverlay

- Botão flutuante draggável exibido sobre o jogo
- Expande para mostrar 3 botões: Rescue Records, Memory Fragments, Combatants
- Barra de progresso durante scan ativo
- Minimiza para ícone pequeno quando não em uso

### ResultsScreen

- Resumo pós-captura: contagem por tipo
- Botão "Exportar JSON" → abre share sheet do Android
- Botão "Capturar novamente" → volta ao overlay

---

## File Structure

```
android-app/
├── app/src/main/
│   ├── java/com/czn/scanner/
│   │   ├── service/
│   │   │   ├── CaptureService.kt
│   │   │   └── CZNAccessibilityService.kt
│   │   ├── capture/
│   │   │   ├── ScreenshotManager.kt
│   │   │   ├── MLKitOCREngine.kt
│   │   │   └── GestureDispatcher.kt
│   │   ├── scanner/
│   │   │   ├── RescueRecordScanner.kt
│   │   │   ├── MemoryFragmentScanner.kt
│   │   │   └── CombatantScanner.kt
│   │   ├── parser/
│   │   │   ├── StatParser.kt
│   │   │   ├── RarityParser.kt
│   │   │   └── FragmentParser.kt
│   │   ├── model/
│   │   │   ├── MemoryFragment.kt
│   │   │   ├── RescueRecord.kt
│   │   │   └── Combatant.kt
│   │   ├── export/
│   │   │   └── JSONExporter.kt
│   │   └── ui/
│   │       ├── MainActivity.kt
│   │       ├── PermissionsScreen.kt
│   │       ├── FloatingOverlay.kt
│   │       └── ResultsScreen.kt
│   └── res/
│       └── xml/
│           └── accessibility_service_config.xml
├── build.gradle.kts
└── AndroidManifest.xml
```

---

## Open Questions / Risks

1. **Coordinate detection accuracy:** UI element positions may vary across screen sizes and resolutions. Bounding box approach handles this but needs testing on different devices.

2. **Animation timing:** After gestures, fixed delays (e.g., 800ms) are used initially. May need tuning per device speed.

3. **Roll count detection:** The "+2" in "Health +2" must be correctly separated from the stat value "+31" on the same line — these appear as two separate text blocks in ML Kit output.

4. **Equipped fragment detection on Combatants screen:** May require additional screenshot of the Memory Fragments sub-tab per character, increasing scan time.

5. **`is_featured` in Rescue Records:** Determined by text color (orange = featured). Since ML Kit doesn't return color, this will use a heuristic: if the name matches a 5-star character/partner in the game database, flag as potentially featured.
