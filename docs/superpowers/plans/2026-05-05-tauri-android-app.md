# Tauri Android App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Android build to the existing Tauri v2 project with MediaProjection screen capture, ML Kit on-device OCR, local SQLite storage, and six screens: Capture, Combatants, Fragments, Rescue Records, Optimizer, Scoring.

**Architecture:** Dedicated `src-mobile/` entry point alongside existing `src/` desktop frontend. A custom Tauri plugin written in Kotlin (`capture-ocr`) handles MediaProjection screen capture and ML Kit OCR, returning structured JSON to the React frontend. All state in local SQLite via `@tauri-apps/plugin-sql`. Gear scores computed at render time from current weights — never stored.

**Tech Stack:** Tauri v2, React 19, TypeScript, Kotlin (minSdk 26), ML Kit Text Recognition v2, `@tauri-apps/plugin-sql`, Vitest

---

## File Map

**New files:**
- `index-mobile.html` — mobile HTML shell
- `src-mobile/main-mobile.tsx` — mobile entry point
- `src-mobile/App.mobile.tsx` — bottom tab navigation root
- `src-mobile/lib/types.ts` — shared TypeScript types
- `src-mobile/lib/db.ts` — SQLite init + schema helpers
- `src-mobile/lib/scoring.ts` — `calcGearScore()` pure function
- `src-mobile/lib/optimizer.ts` — greedy slot optimizer
- `src-mobile/lib/parser/ScreenParser.ts` — OCR dispatcher
- `src-mobile/lib/parser/CombatantParser.ts`
- `src-mobile/lib/parser/FragmentParser.ts`
- `src-mobile/lib/parser/RescueParser.ts`
- `src-mobile/lib/__tests__/scoring.test.ts`
- `src-mobile/lib/__tests__/optimizer.test.ts`
- `src-mobile/lib/parser/__tests__/CombatantParser.test.ts`
- `src-mobile/lib/parser/__tests__/FragmentParser.test.ts`
- `src-mobile/lib/parser/__tests__/RescueParser.test.ts`
- `src-mobile/lib/parser/__tests__/ScreenParser.test.ts`
- `src-mobile/pages/CapturePage.tsx`
- `src-mobile/pages/CombatantsPage.tsx`
- `src-mobile/pages/FragmentsPage.tsx`
- `src-mobile/pages/RescuePage.tsx`
- `src-mobile/pages/OptimizerPage.tsx`
- `src-mobile/pages/ScoringPage.tsx`
- `src-tauri/plugins/capture-ocr/Cargo.toml`
- `src-tauri/plugins/capture-ocr/src/lib.rs`
- `src-tauri/plugins/capture-ocr/android/build.gradle`
- `src-tauri/plugins/capture-ocr/android/src/main/AndroidManifest.xml`
- `src-tauri/plugins/capture-ocr/android/src/main/kotlin/com/plugin/captureocr/CaptureOcrPlugin.kt`
- `src-tauri/plugins/capture-ocr/android/src/main/kotlin/com/plugin/captureocr/ScreenCaptureService.kt`
- `src-tauri/capabilities/android.json`

**Modified files:**
- `package.json` — add `@tauri-apps/plugin-sql`, `vitest`
- `vite.config.ts` — add `mobile` build input
- `src-tauri/Cargo.toml` — add `plugin-sql`, `capture-ocr` workspace member
- `src-tauri/src/lib.rs` — register `plugin-sql` and `capture-ocr`
- `android/app/src/main/AndroidManifest.xml` — add FOREGROUND_SERVICE permissions (after `tauri android init`)

---

## Task 1: Dependencies + Android Build Environment

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Install npm dependencies**

```bash
npm install @tauri-apps/plugin-sql
npm install --save-dev vitest @vitest/ui jsdom
```

- [ ] **Step 2: Add plugin-sql to Cargo.toml**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:
```toml
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

- [ ] **Step 3: Install Rust Android targets**

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

- [ ] **Step 4: Verify Android SDK + NDK are available**

```bash
# Should print a path — if empty, set ANDROID_HOME and NDK_HOME in your shell profile
echo $env:ANDROID_HOME
echo $env:NDK_HOME
```

Both must be set before `tauri android init` can succeed. Typical Windows paths:
- `ANDROID_HOME = C:\Android\sdk`
- `NDK_HOME = C:\Android\sdk\ndk\<version>`

- [ ] **Step 5: Run tauri android init**

```bash
npx tauri android init
```

This generates the `android/` folder. Commit the result:

```bash
git add android/ src-tauri/gen/
git commit -m "chore: tauri android init"
```

---

## Task 2: Vite Mobile Entry Point

**Files:**
- Create: `index-mobile.html`
- Modify: `vite.config.ts`
- Create: `src-mobile/main-mobile.tsx`

- [ ] **Step 1: Create index-mobile.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <title>Hub CZN</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src-mobile/main-mobile.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Update vite.config.ts to support dual entry points**

Replace the entire `vite.config.ts` with:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const isMobile = process.env.TAURI_PLATFORM === "android" || process.env.TAURI_PLATFORM === "ios";

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@mobile": path.resolve(__dirname, "./src-mobile"),
    },
  },
  root: ".",
  build: {
    rollupOptions: {
      input: isMobile
        ? { mobile: path.resolve(__dirname, "index-mobile.html") }
        : { main: path.resolve(__dirname, "index.html") },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
```

- [ ] **Step 3: Create src-mobile/main-mobile.tsx (stub)**

```tsx
import React from "react"
import ReactDOM from "react-dom/client"
import { AppMobile } from "./App.mobile"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppMobile />
  </React.StrictMode>
)
```

- [ ] **Step 4: Commit**

```bash
git add index-mobile.html vite.config.ts src-mobile/main-mobile.tsx
git commit -m "feat(mobile): add dual Vite entry point for Android"
```

---

## Task 3: Shared Types + SQLite DB Initialization

**Files:**
- Create: `src-mobile/lib/types.ts`
- Create: `src-mobile/lib/db.ts`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create src-mobile/lib/types.ts**

```typescript
export type OcrBlock = {
  text: string
  x: number
  y: number
  width: number
  height: number
}

export type SubstatEntry = {
  stat: string
  value: number
  isPercent: boolean
}

export type CombatantData = {
  char_id: string
  name: string
  level: number
  max_level: number
  stars: number
  attack: number
  defense: number
  health: number
  crit_chance: number
  crit_damage: number
}

export type FragmentData = {
  name: string
  set_name: string
  slot: number        // 1–6
  rarity: string      // "Legendary" | "Epic" | "Rare" | "Uncommon"
  upgrade: number     // 0–5
  substats: SubstatEntry[]
}

export type RescuePull = {
  banner_name: string
  char_name: string
  type: string        // "Partners" | "Combatants"
  rescue_type: string
  rescue_time: string
}

export type ScoringWeights = Record<string, number>

export type DbCombatant = CombatantData & { id: number; captured_at: string }
export type DbFragment   = FragmentData & { id: number; captured_at: string }
export type DbRescuePull = RescuePull   & { id: number }
```

- [ ] **Step 2: Create src-mobile/lib/db.ts**

```typescript
import Database from "@tauri-apps/plugin-sql"

let _db: Database | null = null

export async function getDb(): Promise<Database> {
  if (_db) return _db
  _db = await Database.load("sqlite:hubczn_mobile.db")
  await _db.execute(`
    CREATE TABLE IF NOT EXISTS combatants (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      char_id     TEXT,
      name        TEXT,
      level       INTEGER,
      max_level   INTEGER,
      stars       INTEGER,
      attack      INTEGER,
      defense     INTEGER,
      health      INTEGER,
      crit_chance REAL,
      crit_damage REAL,
      captured_at TEXT
    );
    CREATE TABLE IF NOT EXISTS fragments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT,
      set_name    TEXT,
      slot        INTEGER,
      rarity      TEXT,
      upgrade     INTEGER,
      substats    TEXT,
      captured_at TEXT
    );
    CREATE TABLE IF NOT EXISTS rescue_pulls (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      banner_name TEXT,
      char_name   TEXT,
      type        TEXT,
      rescue_type TEXT,
      rescue_time TEXT,
      UNIQUE(banner_name, char_name, rescue_time)
    );
    CREATE TABLE IF NOT EXISTS scoring_weights (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      char_id     TEXT UNIQUE,
      weights     TEXT,
      updated_at  TEXT
    );
  `)
  return _db
}

export async function getGlobalWeights(): Promise<Record<string, number>> {
  const db = await getDb()
  const rows = await db.select<{ weights: string }[]>(
    "SELECT weights FROM scoring_weights WHERE char_id IS NULL LIMIT 1"
  )
  if (rows.length === 0) return {}
  return JSON.parse(rows[0].weights)
}

export async function saveWeights(charId: string | null, weights: Record<string, number>): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO scoring_weights (char_id, weights, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(char_id) DO UPDATE SET weights = excluded.weights, updated_at = excluded.updated_at`,
    [charId, JSON.stringify(weights), new Date().toISOString()]
  )
}
```

- [ ] **Step 3: Register plugin-sql in src-tauri/src/lib.rs**

Find the `.plugin(tauri_plugin_opener::init())` line and add `plugin-sql` before it:

```rust
.plugin(tauri_plugin_sql::Builder::new().build())
.plugin(tauri_plugin_opener::init())
```

Also add the use statement at the top if needed — `tauri_plugin_sql` is used via the builder pattern, no extra import required.

- [ ] **Step 4: Commit**

```bash
git add src-mobile/lib/types.ts src-mobile/lib/db.ts src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat(mobile): add shared types and SQLite DB initialization"
```

---

## Task 4: Vitest Setup + calcGearScore

**Files:**
- Create: `vitest.config.ts`
- Create: `src-mobile/lib/scoring.ts`
- Create: `src-mobile/lib/__tests__/scoring.test.ts`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src-mobile/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@mobile": path.resolve(__dirname, "./src-mobile"),
    },
  },
})
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write failing test**

Create `src-mobile/lib/__tests__/scoring.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { calcGearScore } from "../scoring"
import type { SubstatEntry } from "../types"

describe("calcGearScore", () => {
  it("returns 0 for empty substats", () => {
    expect(calcGearScore([], { Attack: 5 })).toBe(0)
  })

  it("sums weighted substat values", () => {
    const substats: SubstatEntry[] = [
      { stat: "Attack", value: 22, isPercent: false },
      { stat: "Critical Chance", value: 1.6, isPercent: true },
    ]
    const weights = { Attack: 1, "Critical Chance": 10 }
    // 22 * 1 + 1.6 * 10 = 38
    expect(calcGearScore(substats, weights)).toBeCloseTo(38)
  })

  it("ignores substats with no weight entry (defaults to 0)", () => {
    const substats: SubstatEntry[] = [
      { stat: "Defense", value: 50, isPercent: false },
    ]
    expect(calcGearScore(substats, { Attack: 5 })).toBe(0)
  })

  it("handles all-zero weights", () => {
    const substats: SubstatEntry[] = [
      { stat: "Attack", value: 100, isPercent: false },
    ]
    expect(calcGearScore(substats, { Attack: 0 })).toBe(0)
  })
})
```

- [ ] **Step 4: Run test — verify it fails**

```bash
npm test
```

Expected: FAIL with "Cannot find module '../scoring'"

- [ ] **Step 5: Create src-mobile/lib/scoring.ts**

```typescript
import type { SubstatEntry } from "./types"

export function calcGearScore(
  substats: SubstatEntry[],
  weights: Record<string, number>
): number {
  return substats.reduce((total, { stat, value }) => {
    return total + (weights[stat] ?? 0) * value
  }, 0)
}
```

- [ ] **Step 6: Run test — verify it passes**

```bash
npm test
```

Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts src-mobile/lib/scoring.ts src-mobile/lib/__tests__/scoring.test.ts package.json
git commit -m "feat(mobile): add calcGearScore with Vitest setup"
```

---

## Task 5: CombatantParser

**Files:**
- Create: `src-mobile/lib/parser/CombatantParser.ts`
- Create: `src-mobile/lib/parser/__tests__/CombatantParser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src-mobile/lib/parser/__tests__/CombatantParser.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { parseCombatant } from "../CombatantParser"
import type { OcrBlock } from "../../types"

const makeBlock = (text: string, x = 0, y = 0): OcrBlock => ({ text, x, y, width: 100, height: 20 })

describe("parseCombatant", () => {
  const sampleBlocks: OcrBlock[] = [
    makeBlock("Details", 10, 50),
    makeBlock("Stats", 10, 80),
    makeBlock("Cards", 10, 110),
    makeBlock("Partners", 10, 140),
    makeBlock("Save Data", 10, 170),
    makeBlock("Potential", 10, 200),
    makeBlock("Memory Fragments", 10, 230),
    makeBlock("Ego Manifestation", 10, 260),
    makeBlock("Heidemarie", 500, 80),
    makeBlock("Lv. 60/60", 500, 120),
    makeBlock("Stats", 500, 160),
    makeBlock("Attack", 500, 200),
    makeBlock("1052", 700, 200),
    makeBlock("Defense", 500, 230),
    makeBlock("184", 700, 230),
    makeBlock("Health", 500, 260),
    makeBlock("514", 700, 260),
    makeBlock("Critical Chance", 500, 290),
    makeBlock("36.8%", 700, 290),
    makeBlock("Critical Damage", 500, 320),
    makeBlock("237.0%", 700, 320),
  ]

  it("returns null when no Lv. pattern found", () => {
    expect(parseCombatant([makeBlock("random text")])).toBeNull()
  })

  it("extracts level and max level", () => {
    const result = parseCombatant(sampleBlocks)
    expect(result?.level).toBe(60)
    expect(result?.max_level).toBe(60)
  })

  it("extracts character name", () => {
    expect(parseCombatant(sampleBlocks)?.name).toBe("Heidemarie")
  })

  it("extracts numeric stats", () => {
    const result = parseCombatant(sampleBlocks)
    expect(result?.attack).toBe(1052)
    expect(result?.defense).toBe(184)
    expect(result?.health).toBe(514)
  })

  it("extracts percent stats", () => {
    const result = parseCombatant(sampleBlocks)
    expect(result?.crit_chance).toBeCloseTo(36.8)
    expect(result?.crit_damage).toBeCloseTo(237.0)
  })

  it("generates char_id from name", () => {
    expect(parseCombatant(sampleBlocks)?.char_id).toBe("heidemarie")
  })
})
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test
```

Expected: FAIL with "Cannot find module '../CombatantParser'"

- [ ] **Step 3: Create src-mobile/lib/parser/CombatantParser.ts**

```typescript
import type { OcrBlock, CombatantData } from "../types"

const UI_LABELS = new Set([
  "Details", "Stats", "Cards", "Partners", "Save Data",
  "Potential", "Memory Fragments", "Ego Manifestation", "i",
])

function extractStat(blocks: OcrBlock[], label: string): number {
  const idx = blocks.findIndex(b => b.text.trim() === label)
  if (idx === -1) return 0
  // Value is typically the next block on a similar Y coordinate
  for (let i = idx + 1; i < Math.min(idx + 4, blocks.length); i++) {
    const numStr = blocks[i].text.replace("%", "").trim()
    const val = parseFloat(numStr)
    if (!isNaN(val)) return val
  }
  return 0
}

export function parseCombatant(blocks: OcrBlock[]): CombatantData | null {
  const lvIdx = blocks.findIndex(b => /^Lv\.\s*\d+\/\d+$/.test(b.text.trim()))
  if (lvIdx === -1) return null

  const lvMatch = blocks[lvIdx].text.match(/(\d+)\/(\d+)/)!
  const level    = parseInt(lvMatch[1])
  const maxLevel = parseInt(lvMatch[2])

  // Character name: walk backwards from Lv. block, skip known UI labels
  let name = ""
  for (let i = lvIdx - 1; i >= 0; i--) {
    const t = blocks[i].text.trim()
    if (!UI_LABELS.has(t) && t.length > 1 && !/^\d/.test(t)) {
      name = t
      break
    }
  }
  if (!name) return null

  return {
    char_id: name.toLowerCase().replace(/\s+/g, "_"),
    name,
    level,
    max_level: maxLevel,
    stars: 5,
    attack:      extractStat(blocks, "Attack"),
    defense:     extractStat(blocks, "Defense"),
    health:      extractStat(blocks, "Health"),
    crit_chance: extractStat(blocks, "Critical Chance"),
    crit_damage: extractStat(blocks, "Critical Damage"),
  }
}
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test
```

Expected: all CombatantParser tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-mobile/lib/parser/CombatantParser.ts src-mobile/lib/parser/__tests__/CombatantParser.test.ts
git commit -m "feat(mobile): add CombatantParser with tests"
```

---

## Task 6: FragmentParser

**Files:**
- Create: `src-mobile/lib/parser/FragmentParser.ts`
- Create: `src-mobile/lib/parser/__tests__/FragmentParser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src-mobile/lib/parser/__tests__/FragmentParser.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { parseFragment } from "../FragmentParser"
import type { OcrBlock } from "../../types"

const b = (text: string, x = 0, y = 0): OcrBlock => ({ text, x, y, width: 100, height: 20 })

describe("parseFragment", () => {
  // Mirrors the "Healer's Journey Shock" screenshot
  const sampleBlocks: OcrBlock[] = [
    b("I", 170, 50),               // slot badge
    b("Legendary", 500, 60),
    b("Healer's Journey Shock", 500, 100),
    b("Attack", 500, 150),
    b("+22", 750, 150),
    b("Health", 500, 180),
    b("1%", 750, 180),
    b("Health +2", 500, 210),
    b("+31", 750, 210),
    b("Attack +2", 500, 240),
    b("2.6%", 750, 240),
    b("Critical Chance", 500, 270),
    b("+1.6%", 750, 270),
    b("Set Effect", 500, 310),
    b("Healer's Journey", 500, 340),
    b("Upgrade", 500, 380),
    b("+5", 600, 380),
  ]

  it("returns null when no rarity badge found", () => {
    expect(parseFragment([b("random text")])).toBeNull()
  })

  it("detects slot from roman numeral", () => {
    expect(parseFragment(sampleBlocks)?.slot).toBe(1)
  })

  it("extracts rarity", () => {
    expect(parseFragment(sampleBlocks)?.rarity).toBe("Legendary")
  })

  it("extracts fragment name", () => {
    expect(parseFragment(sampleBlocks)?.name).toBe("Healer's Journey Shock")
  })

  it("extracts set name", () => {
    expect(parseFragment(sampleBlocks)?.set_name).toBe("Healer's Journey")
  })

  it("extracts upgrade level", () => {
    expect(parseFragment(sampleBlocks)?.upgrade).toBe(5)
  })

  it("extracts substats with correct values", () => {
    const result = parseFragment(sampleBlocks)
    expect(result?.substats).toHaveLength(5)
    expect(result?.substats[0]).toMatchObject({ stat: "Attack", value: 22, isPercent: false })
    expect(result?.substats[1]).toMatchObject({ stat: "Health", value: 1, isPercent: true })
    expect(result?.substats[4]).toMatchObject({ stat: "Critical Chance", value: 1.6, isPercent: true })
  })
})
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test
```

- [ ] **Step 3: Create src-mobile/lib/parser/FragmentParser.ts**

```typescript
import type { OcrBlock, FragmentData, SubstatEntry } from "../types"

const RARITIES = ["Legendary", "Epic", "Rare", "Uncommon", "Common"]
const ROMAN_SLOT: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6,
}
const STAT_NAMES = [
  "Attack", "Defense", "Health", "Critical Chance", "Critical Damage",
  "Speed", "Resistance", "Accuracy",
  "Attack +2", "Defense +2", "Health +2", "Critical Chance +2", "Critical Damage +2",
  "Speed +2", "Resistance +2", "Accuracy +2",
]

export function parseFragment(blocks: OcrBlock[]): FragmentData | null {
  // Detect rarity
  const rarityBlock = blocks.find(b => RARITIES.includes(b.text.trim()))
  if (!rarityBlock) return null
  const rarity = rarityBlock.text.trim()

  // Detect slot from roman numeral badge
  const slotBlock = blocks.find(b => ROMAN_SLOT[b.text.trim()] !== undefined)
  if (!slotBlock) return null
  const slot = ROMAN_SLOT[slotBlock.text.trim()]

  // Fragment name: block after rarity that is not a stat name
  const rarityIdx = blocks.indexOf(rarityBlock)
  let name = ""
  for (let i = rarityIdx + 1; i < blocks.length; i++) {
    const t = blocks[i].text.trim()
    if (STAT_NAMES.some(s => t === s || t.startsWith(s))) break
    if (t.length > 2) { name = t; break }
  }
  if (!name) return null

  // Set name: block after "Set Effect"
  const setIdx = blocks.findIndex(b => b.text.trim() === "Set Effect")
  const set_name = setIdx >= 0 ? (blocks[setIdx + 1]?.text.trim() ?? "") : ""

  // Upgrade level: find "+N" after "Upgrade"
  const upgradeIdx = blocks.findIndex(b => b.text.trim() === "Upgrade")
  let upgrade = 0
  if (upgradeIdx >= 0) {
    const upgradeVal = blocks[upgradeIdx + 1]?.text.trim() ?? ""
    const m = upgradeVal.match(/\+?(\d)/)
    if (m) upgrade = parseInt(m[1])
  }

  // Substats: pair each stat-name block with the next numeric block
  const substats: SubstatEntry[] = []
  for (let i = 0; i < blocks.length - 1; i++) {
    const t = blocks[i].text.trim()
    const matchedStat = STAT_NAMES.find(s => t === s)
    if (!matchedStat) continue

    const valueText = blocks[i + 1]?.text.trim() ?? ""
    const isPercent  = valueText.includes("%")
    const m = valueText.replace("+", "").replace("%", "")
    const value = parseFloat(m)
    if (!isNaN(value)) {
      substats.push({ stat: matchedStat, value, isPercent })
    }
  }

  if (substats.length === 0) return null
  return { name, set_name, slot, rarity, upgrade, substats }
}
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src-mobile/lib/parser/FragmentParser.ts src-mobile/lib/parser/__tests__/FragmentParser.test.ts
git commit -m "feat(mobile): add FragmentParser with tests"
```

---

## Task 7: RescueParser

**Files:**
- Create: `src-mobile/lib/parser/RescueParser.ts`
- Create: `src-mobile/lib/parser/__tests__/RescueParser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src-mobile/lib/parser/__tests__/RescueParser.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { parseRescue } from "../RescueParser"
import type { OcrBlock } from "../../types"

const b = (text: string, y = 0): OcrBlock => ({ text, x: 0, y, width: 200, height: 20 })

describe("parseRescue", () => {
  const sampleBlocks: OcrBlock[] = [
    b("Content Guide", 30),
    b("Probability Guide", 30),
    b("Rescue Records", 30),
    b("Amplified Distress Signal: Heidemarie", 80),
    b("You can view your Rescue history from the past 6 months.", 130),
    b("Type", 200),
    b("Rescue List", 200),
    b("Rescue Type", 200),
    b("Rescue Time", 200),
    b("Partners", 240),
    b("Akad", 240),
    b("Seasonal Combatant Rescue Rate-Up", 240),
    b("2026-04-29 08:16:56", 240),
    b("Partners", 270),
    b("Douglas", 270),
    b("Seasonal Combatant Rescue Rate-Up", 270),
    b("2026-04-29 08:16:56", 270),
    b("Combatants", 300),
    b("Selena", 300),
    b("Seasonal Combatant Rescue Rate-Up", 300),
    b("2026-04-29 08:16:56", 300),
  ]

  it("returns null when 'Rescue Records' not in blocks", () => {
    expect(parseRescue([b("random")])).toBeNull()
  })

  it("extracts banner name", () => {
    const result = parseRescue(sampleBlocks)
    expect(result?.banner_name).toBe("Heidemarie")
  })

  it("extracts correct number of pulls", () => {
    expect(parseRescue(sampleBlocks)?.pulls).toHaveLength(3)
  })

  it("extracts pull fields correctly", () => {
    const pulls = parseRescue(sampleBlocks)?.pulls ?? []
    expect(pulls[0]).toMatchObject({
      banner_name: "Heidemarie",
      char_name: "Akad",
      type: "Partners",
      rescue_type: "Seasonal Combatant Rescue Rate-Up",
      rescue_time: "2026-04-29 08:16:56",
    })
    expect(pulls[2].type).toBe("Combatants")
    expect(pulls[2].char_name).toBe("Selena")
  })
})
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test
```

- [ ] **Step 3: Create src-mobile/lib/parser/RescueParser.ts**

```typescript
import type { OcrBlock, RescuePull } from "../types"

const TYPES = new Set(["Partners", "Combatants"])
const DATE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const HEADER_LABELS = new Set(["Type", "Rescue List", "Rescue Type", "Rescue Time"])

export function parseRescue(
  blocks: OcrBlock[]
): { banner_name: string; pulls: RescuePull[] } | null {
  // Must contain "Rescue Records"
  if (!blocks.some(b => b.text.trim() === "Rescue Records")) return null

  // Extract banner name from "Amplified Distress Signal: NAME"
  const bannerBlock = blocks.find(b => b.text.includes("Amplified Distress Signal:"))
  if (!bannerBlock) return null
  const banner_name = bannerBlock.text.split(":")[1]?.trim() ?? ""

  // Group blocks by Y coordinate (rows within ±15px)
  const rows: OcrBlock[][] = []
  for (const block of blocks) {
    const existing = rows.find(row => Math.abs(row[0].y - block.y) < 15)
    if (existing) {
      existing.push(block)
    } else {
      rows.push([block])
    }
  }
  // Sort rows top-to-bottom, blocks left-to-right within each row
  rows.sort((a, b) => a[0].y - b[0].y)
  rows.forEach(row => row.sort((a, b) => a.x - b.x))

  const pulls: RescuePull[] = []

  for (const row of rows) {
    const texts = row.map(b => b.text.trim())
    // A data row: first cell is "Partners" or "Combatants", last cell is a datetime
    if (
      texts.length >= 4 &&
      TYPES.has(texts[0]) &&
      DATE_RE.test(texts[texts.length - 1]) &&
      !HEADER_LABELS.has(texts[1])
    ) {
      pulls.push({
        banner_name,
        char_name: texts[1],
        type: texts[0],
        rescue_type: texts[2],
        rescue_time: texts[texts.length - 1],
      })
    }
  }

  return { banner_name, pulls }
}
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src-mobile/lib/parser/RescueParser.ts src-mobile/lib/parser/__tests__/RescueParser.test.ts
git commit -m "feat(mobile): add RescueParser with tests"
```

---

## Task 8: ScreenParser Dispatcher

**Files:**
- Create: `src-mobile/lib/parser/ScreenParser.ts`
- Create: `src-mobile/lib/parser/__tests__/ScreenParser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src-mobile/lib/parser/__tests__/ScreenParser.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { detectScreenType, parseScreen } from "../ScreenParser"
import type { OcrBlock } from "../../types"

const b = (text: string): OcrBlock => ({ text, x: 0, y: 0, width: 100, height: 20 })

describe("detectScreenType", () => {
  it("detects rescue screen", () => {
    expect(detectScreenType([b("Rescue Records"), b("Rescue Time")])).toBe("rescue")
  })

  it("detects fragment screen", () => {
    expect(detectScreenType([b("I"), b("Legendary"), b("Set Effect")])).toBe("fragment")
  })

  it("detects combatant screen", () => {
    expect(detectScreenType([b("Lv. 60/60"), b("Critical Chance")])).toBe("combatant")
  })

  it("returns unknown for unrecognized screens", () => {
    expect(detectScreenType([b("Some random text")])).toBe("unknown")
  })
})

describe("parseScreen", () => {
  it("returns { type: 'unknown' } for unrecognized OCR", () => {
    const result = parseScreen([b("gibberish")])
    expect(result.type).toBe("unknown")
  })
})
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test
```

- [ ] **Step 3: Create src-mobile/lib/parser/ScreenParser.ts**

```typescript
import type { OcrBlock, CombatantData, FragmentData, RescuePull } from "../types"
import { parseCombatant } from "./CombatantParser"
import { parseFragment } from "./FragmentParser"
import { parseRescue } from "./RescueParser"

export type ScreenType = "rescue" | "fragment" | "combatant" | "unknown"

export type ParseResult =
  | { type: "rescue";    banner_name: string; pulls: RescuePull[] }
  | { type: "fragment";  data: FragmentData }
  | { type: "combatant"; data: CombatantData }
  | { type: "unknown" }

export function detectScreenType(blocks: OcrBlock[]): ScreenType {
  const texts = new Set(blocks.map(b => b.text.trim()))
  const allText = blocks.map(b => b.text).join(" ")

  if (texts.has("Rescue Records") && allText.includes("Rescue Time")) return "rescue"
  if (
    blocks.some(b => ["Legendary", "Epic", "Rare", "Uncommon"].includes(b.text.trim())) &&
    texts.has("Set Effect")
  ) return "fragment"
  if (/Lv\.\s*\d+\/\d+/.test(allText) && texts.has("Critical Chance")) return "combatant"
  return "unknown"
}

export function parseScreen(blocks: OcrBlock[]): ParseResult {
  const type = detectScreenType(blocks)

  if (type === "rescue") {
    const result = parseRescue(blocks)
    if (result) return { type: "rescue", ...result }
  }

  if (type === "fragment") {
    const data = parseFragment(blocks)
    if (data) return { type: "fragment", data }
  }

  if (type === "combatant") {
    const data = parseCombatant(blocks)
    if (data) return { type: "combatant", data }
  }

  return { type: "unknown" }
}
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src-mobile/lib/parser/ScreenParser.ts src-mobile/lib/parser/__tests__/ScreenParser.test.ts
git commit -m "feat(mobile): add ScreenParser dispatcher with tests"
```

---

## Task 9: Optimizer Logic

**Files:**
- Create: `src-mobile/lib/optimizer.ts`
- Create: `src-mobile/lib/__tests__/optimizer.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src-mobile/lib/__tests__/optimizer.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { optimize } from "../optimizer"
import type { DbFragment } from "../types"

function makeFragment(id: number, slot: number, stats: Record<string, number>): DbFragment {
  return {
    id,
    slot,
    name: `Fragment ${id}`,
    set_name: "TestSet",
    rarity: "Epic",
    upgrade: 0,
    substats: Object.entries(stats).map(([stat, value]) => ({
      stat, value, isPercent: false,
    })),
    captured_at: "2026-01-01T00:00:00Z",
  }
}

describe("optimize", () => {
  const weights = { Attack: 5, "Critical Chance": 10 }

  it("returns null for slots with no fragments", () => {
    const result = optimize([], weights)
    expect(result[1]).toBeNull()
    expect(result[6]).toBeNull()
  })

  it("picks the highest scoring fragment per slot", () => {
    const fragments = [
      makeFragment(1, 1, { Attack: 10 }),         // score = 50
      makeFragment(2, 1, { "Critical Chance": 8 }), // score = 80  ← winner
      makeFragment(3, 1, { Attack: 5 }),            // score = 25
    ]
    const result = optimize(fragments, weights)
    expect(result[1]?.id).toBe(2)
  })

  it("handles multiple slots independently", () => {
    const fragments = [
      makeFragment(1, 1, { Attack: 20 }),           // slot 1: score 100
      makeFragment(2, 2, { "Critical Chance": 5 }), // slot 2: score 50
      makeFragment(3, 2, { Attack: 30 }),            // slot 2: score 150 ← winner
    ]
    const result = optimize(fragments, weights)
    expect(result[1]?.id).toBe(1)
    expect(result[2]?.id).toBe(3)
  })
})
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test
```

- [ ] **Step 3: Create src-mobile/lib/optimizer.ts**

```typescript
import { calcGearScore } from "./scoring"
import type { DbFragment } from "./types"

export type OptimizationResult = Record<number, DbFragment | null>

export function optimize(
  fragments: DbFragment[],
  weights: Record<string, number>
): OptimizationResult {
  const bySlot: Record<number, DbFragment[]> = {}
  for (const f of fragments) {
    if (!bySlot[f.slot]) bySlot[f.slot] = []
    bySlot[f.slot].push(f)
  }

  const result: OptimizationResult = {}
  for (let slot = 1; slot <= 6; slot++) {
    const candidates = bySlot[slot] ?? []
    if (candidates.length === 0) {
      result[slot] = null
      continue
    }
    result[slot] = candidates.reduce((best, f) => {
      return calcGearScore(f.substats, weights) > calcGearScore(best.substats, weights) ? f : best
    })
  }
  return result
}
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src-mobile/lib/optimizer.ts src-mobile/lib/__tests__/optimizer.test.ts
git commit -m "feat(mobile): add greedy slot optimizer with tests"
```

---

## Task 10: Capture-OCR Plugin — Rust Skeleton

**Files:**
- Create: `src-tauri/plugins/capture-ocr/Cargo.toml`
- Create: `src-tauri/plugins/capture-ocr/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Create src-tauri/plugins/capture-ocr/Cargo.toml**

```toml
[package]
name = "tauri-plugin-capture-ocr"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2: Create src-tauri/plugins/capture-ocr/src/lib.rs**

```rust
use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("capture-ocr")
        .setup(|_app, api| {
            #[cfg(target_os = "android")]
            api.register_android_plugin("com.plugin.captureocr", "CaptureOcrPlugin")?;
            Ok(())
        })
        .build()
}
```

- [ ] **Step 3: Add plugin to src-tauri/Cargo.toml as workspace member**

Add at the top of `src-tauri/Cargo.toml` (before `[package]`):

```toml
[workspace]
members = [".", "plugins/capture-ocr"]
```

Also add to `[dependencies]`:

```toml
tauri-plugin-capture-ocr = { path = "plugins/capture-ocr" }
```

- [ ] **Step 4: Register plugin in src-tauri/src/lib.rs**

Add to the plugin chain in `run()`:

```rust
.plugin(tauri_plugin_capture_ocr::init())
```

Place it before `.plugin(tauri_plugin_opener::init())`.

Also add the use/extern at the file top — not needed, just reference the crate directly.

- [ ] **Step 5: Verify the Rust builds**

```bash
cd src-tauri && cargo check
```

Expected: no errors (the Kotlin side isn't compiled here)

- [ ] **Step 6: Commit**

```bash
git add src-tauri/plugins/capture-ocr/ src-tauri/Cargo.toml src-tauri/src/lib.rs
git commit -m "feat(mobile): add capture-ocr Tauri plugin Rust skeleton"
```

---

## Task 11: Capture-OCR Plugin — Kotlin (MediaProjection)

**Files:**
- Create: `src-tauri/plugins/capture-ocr/android/build.gradle`
- Create: `src-tauri/plugins/capture-ocr/android/src/main/AndroidManifest.xml`
- Create: `src-tauri/plugins/capture-ocr/android/src/main/kotlin/com/plugin/captureocr/CaptureOcrPlugin.kt`
- Create: `src-tauri/plugins/capture-ocr/android/src/main/kotlin/com/plugin/captureocr/ScreenCaptureService.kt`

- [ ] **Step 1: Create android/build.gradle**

```groovy
plugins {
    id 'com.android.library'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace 'com.plugin.captureocr'
    compileSdk 35

    defaultConfig {
        minSdk 26
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation 'app.tauri:plugin:2.2.2'
    implementation 'com.google.mlkit:text-recognition:16.0.1'
}
```

- [ ] **Step 2: Create android/src/main/AndroidManifest.xml**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"/>

    <application>
        <service
            android:name=".ScreenCaptureService"
            android:foregroundServiceType="mediaProjection"
            android:exported="false"/>
    </application>
</manifest>
```

- [ ] **Step 3: Create ScreenCaptureService.kt**

```kotlin
package com.plugin.captureocr

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.DisplayMetrics

class ScreenCaptureService : Service() {

    private var mediaProjection: MediaProjection? = null
    private var imageReader: ImageReader? = null
    private var virtualDisplay: VirtualDisplay? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        val notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Capturing screen")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .build()
        startForeground(NOTIF_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val resultCode = intent?.getIntExtra("resultCode", 0) ?: return START_NOT_STICKY
        val data = intent.getParcelableExtra<Intent>("data") ?: return START_NOT_STICKY

        val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = manager.getMediaProjection(resultCode, data)

        captureFrame()
        return START_NOT_STICKY
    }

    private fun captureFrame() {
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        (getSystemService(WINDOW_SERVICE) as android.view.WindowManager).defaultDisplay.getMetrics(metrics)
        val width  = metrics.widthPixels
        val height = metrics.heightPixels
        val dpi    = metrics.densityDpi

        val reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        imageReader = reader

        virtualDisplay = mediaProjection!!.createVirtualDisplay(
            "CaptureOcr", width, height, dpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.surface, null, null
        )

        Handler(Looper.getMainLooper()).postDelayed({
            val image = reader.acquireLatestImage()
            if (image != null) {
                val planes = image.planes
                val buffer = planes[0].buffer
                val pixelStride = planes[0].pixelStride
                val rowStride   = planes[0].rowStride
                val rowPadding  = rowStride - pixelStride * width
                val bmp = Bitmap.createBitmap(
                    width + rowPadding / pixelStride, height, Bitmap.Config.ARGB_8888
                )
                bmp.copyPixelsFromBuffer(buffer)
                image.close()
                val cropped = Bitmap.createBitmap(bmp, 0, 0, width, height)
                CaptureOcrPlugin.onBitmapReady(cropped)
            }
            cleanup()
            stopSelf()
        }, 300)
    }

    private fun cleanup() {
        virtualDisplay?.release()
        mediaProjection?.stop()
        imageReader?.close()
    }

    override fun onDestroy() {
        cleanup()
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(CHANNEL_ID, "Screen Capture", NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL_ID = "capture_ocr_channel"
        const val NOTIF_ID   = 1001
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/plugins/capture-ocr/android/
git commit -m "feat(mobile): add ScreenCaptureService with MediaProjection"
```

---

## Task 12: Capture-OCR Plugin — Kotlin (ML Kit OCR + Plugin Class)

**Files:**
- Create: `src-tauri/plugins/capture-ocr/android/src/main/kotlin/com/plugin/captureocr/CaptureOcrPlugin.kt`

- [ ] **Step 1: Create CaptureOcrPlugin.kt**

```kotlin
package com.plugin.captureocr

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.media.projection.MediaProjectionManager
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

@TauriPlugin
class CaptureOcrPlugin(private val activity: Activity) : Plugin(activity) {

    companion object {
        // Called by ScreenCaptureService when the bitmap is ready
        var pendingInvoke: Invoke? = null

        fun onBitmapReady(bitmap: Bitmap) {
            val invoke = pendingInvoke ?: return
            pendingInvoke = null
            runOcr(bitmap, invoke)
        }

        private fun runOcr(bitmap: Bitmap, invoke: Invoke) {
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            val image = InputImage.fromBitmap(bitmap, 0)

            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                    val blocksArr = JSArray()
                    for (block in visionText.textBlocks) {
                        for (line in block.lines) {
                            val bb = line.boundingBox
                            val obj = JSObject().apply {
                                put("text",   line.text)
                                put("x",      bb?.left   ?: 0)
                                put("y",      bb?.top    ?: 0)
                                put("width",  bb?.width() ?: 0)
                                put("height", bb?.height() ?: 0)
                            }
                            blocksArr.put(obj)
                        }
                    }
                    val result = JSObject()
                    result.put("blocks", blocksArr)
                    invoke.resolve(result)
                }
                .addOnFailureListener { e ->
                    invoke.reject("OCR failed: ${e.message}")
                }
        }
    }

    @Command
    fun captureScreen(invoke: Invoke) {
        pendingInvoke = invoke
        val manager = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(invoke, manager.createScreenCaptureIntent(), "onProjectionResult")
    }

    @ActivityCallback
    private fun onProjectionResult(invoke: Invoke, result: app.tauri.plugin.PluginResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            invoke.reject("MediaProjection permission denied")
            return
        }
        val data = result.data ?: run {
            invoke.reject("No projection data received")
            return
        }
        pendingInvoke = invoke
        val serviceIntent = Intent(activity, ScreenCaptureService::class.java).apply {
            putExtra("resultCode", result.resultCode)
            putExtra("data", data as android.os.Parcelable)
        }
        activity.startForegroundService(serviceIntent)
        // invoke resolved later when ScreenCaptureService calls CaptureOcrPlugin.onBitmapReady()
    }
}

// Note: if app.tauri.plugin.PluginResult does not exist in your version of app.tauri:plugin,
// check the library source for the correct ActivityCallback result type — it may be
// androidx.activity.result.ActivityResult (requires 'androidx.activity:activity:1.8+' dependency).
```

> **Note for implementer:** Tauri v2's `@ActivityCallback` signature varies by plugin API version. If the above does not compile, check `app.tauri.plugin.ActivityResult` — the callback may need signature `(invoke: Invoke, result: app.tauri.plugin.ActivityResult)`. Pass `result.resultCode` and `result.data` to the service intent directly, instead of hardcoding `RESULT_OK`.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/plugins/capture-ocr/android/src/main/kotlin/com/plugin/captureocr/CaptureOcrPlugin.kt
git commit -m "feat(mobile): add CaptureOcrPlugin with ML Kit OCR"
```

---

## Task 13: Android Permissions + Capabilities

**Files:**
- Create: `src-tauri/capabilities/android.json`
- Modify: `android/app/src/main/AndroidManifest.xml` (generated by tauri android init)

- [ ] **Step 1: Create src-tauri/capabilities/android.json**

```json
{
  "$schema": "../gen/schemas/android-schema.json",
  "identifier": "android-default",
  "description": "Android capabilities",
  "platforms": ["android"],
  "windows": ["main"],
  "permissions": [
    "core:default",
    "sql:allow-execute",
    "sql:allow-select",
    "sql:allow-load"
  ]
}
```

- [ ] **Step 2: Add permissions to android/app/src/main/AndroidManifest.xml**

Open `android/app/src/main/AndroidManifest.xml` (generated by `tauri android init`) and add inside `<manifest>`, before `<application>`:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/capabilities/android.json android/app/src/main/AndroidManifest.xml
git commit -m "feat(mobile): add Android capabilities and permissions"
```

---

## Task 14: CapturePage

**Files:**
- Create: `src-mobile/pages/CapturePage.tsx`

- [ ] **Step 1: Create CapturePage.tsx**

```tsx
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { getDb } from "../lib/db"
import { parseScreen } from "../lib/parser/ScreenParser"
import type { OcrBlock } from "../lib/types"

type Status = "idle" | "capturing" | "saving" | "done" | "error"

export function CapturePage() {
  const [status, setStatus]   = useState<Status>("idle")
  const [message, setMessage] = useState("")

  async function handleCapture() {
    setStatus("capturing")
    setMessage("")
    try {
      const { blocks } = await invoke<{ blocks: OcrBlock[] }>("plugin:capture-ocr|captureScreen")
      const parsed = parseScreen(blocks)

      setStatus("saving")
      const db = await getDb()
      const now = new Date().toISOString()

      if (parsed.type === "combatant") {
        const d = parsed.data
        await db.execute(
          `INSERT OR REPLACE INTO combatants
           (char_id, name, level, max_level, stars, attack, defense, health, crit_chance, crit_damage, captured_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [d.char_id, d.name, d.level, d.max_level, d.stars, d.attack, d.defense, d.health, d.crit_chance, d.crit_damage, now]
        )
        setMessage(`Combatant saved: ${d.name}`)
      } else if (parsed.type === "fragment") {
        const d = parsed.data
        await db.execute(
          `INSERT INTO fragments (name, set_name, slot, rarity, upgrade, substats, captured_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [d.name, d.set_name, d.slot, d.rarity, d.upgrade, JSON.stringify(d.substats), now]
        )
        setMessage(`Fragment saved: ${d.name}`)
      } else if (parsed.type === "rescue") {
        let saved = 0
        for (const pull of parsed.pulls) {
          try {
            await db.execute(
              `INSERT OR IGNORE INTO rescue_pulls (banner_name, char_name, type, rescue_type, rescue_time)
               VALUES (?, ?, ?, ?, ?)`,
              [pull.banner_name, pull.char_name, pull.type, pull.rescue_type, pull.rescue_time]
            )
            saved++
          } catch { /* duplicate — ignored */ }
        }
        setMessage(`${saved} rescue pull${saved !== 1 ? "s" : ""} saved (banner: ${parsed.banner_name})`)
      } else {
        setMessage("Screen not recognized — open Stats, fragment detail, or Rescue Records")
        setStatus("error")
        return
      }

      setStatus("done")
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Capture failed")
      setStatus("error")
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
      <h1 className="text-2xl font-bold text-white">Capture</h1>
      <p className="text-sm text-[#b3b3b3] text-center">
        Open the game screen you want to capture, then tap the button.
      </p>

      <button
        onClick={handleCapture}
        disabled={status === "capturing" || status === "saving"}
        className="w-40 h-40 rounded-full bg-[#c084fc] text-white text-lg font-semibold
                   disabled:opacity-50 active:scale-95 transition-transform"
      >
        {status === "capturing" ? "Capturing…" : status === "saving" ? "Saving…" : "Capture"}
      </button>

      {message && (
        <p className={`text-sm text-center ${status === "error" ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src-mobile/pages/CapturePage.tsx
git commit -m "feat(mobile): add CapturePage"
```

---

## Task 15: CombatantsPage

**Files:**
- Create: `src-mobile/pages/CombatantsPage.tsx`

- [ ] **Step 1: Create CombatantsPage.tsx**

```tsx
import { useEffect, useState } from "react"
import { getDb, getGlobalWeights } from "../lib/db"
import { calcGearScore } from "../lib/scoring"
import type { DbCombatant } from "../lib/types"

export function CombatantsPage() {
  const [combatants, setCombatants] = useState<(DbCombatant & { gs: number })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const db = await getDb()
    const rows = await db.select<DbCombatant[]>("SELECT * FROM combatants ORDER BY captured_at DESC")
    const weights = await getGlobalWeights()
    setCombatants(rows.map(r => ({
      ...r,
      gs: calcGearScore([], weights), // combatants have no substats — GS is display-only
    })))
    setLoading(false)
  }

  async function deleteCombatant(id: number) {
    const db = await getDb()
    await db.execute("DELETE FROM combatants WHERE id = ?", [id])
    setCombatants(prev => prev.filter(c => c.id !== id))
  }

  if (loading) return <div className="flex items-center justify-center h-full text-[#b3b3b3]">Loading…</div>
  if (combatants.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-[#b3b3b3]">
      <p>No combatants captured yet.</p>
      <p className="text-xs">Capture a character's Stats screen to add one.</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-xl font-bold text-white p-4">Combatants</h1>
      <div className="flex-1 overflow-y-auto divide-y divide-[#282828]">
        {combatants.map(c => (
          <div key={c.id} className="flex items-center gap-3 p-4">
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold truncate">{c.name}</p>
              <p className="text-xs text-[#b3b3b3]">Lv. {c.level}/{c.max_level} · ATK {c.attack} · DEF {c.defense}</p>
              <p className="text-xs text-[#b3b3b3]">CC {c.crit_chance}% · CD {c.crit_damage}%</p>
            </div>
            <button
              onClick={() => deleteCombatant(c.id)}
              className="text-xs text-red-400 px-2 py-1 rounded"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src-mobile/pages/CombatantsPage.tsx
git commit -m "feat(mobile): add CombatantsPage"
```

---

## Task 16: FragmentsPage

**Files:**
- Create: `src-mobile/pages/FragmentsPage.tsx`

- [ ] **Step 1: Create FragmentsPage.tsx**

```tsx
import { useEffect, useState } from "react"
import { getDb, getGlobalWeights } from "../lib/db"
import { calcGearScore } from "../lib/scoring"
import type { DbFragment, SubstatEntry } from "../lib/types"

const SLOT_LABELS = ["", "I", "II", "III", "IV", "V", "VI"]

export function FragmentsPage() {
  const [fragments, setFragments] = useState<(DbFragment & { gs: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [slotFilter, setSlotFilter] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const db = await getDb()
    const rows = await db.select<(Omit<DbFragment, "substats"> & { substats: string })[]>(
      "SELECT * FROM fragments ORDER BY captured_at DESC"
    )
    const weights = await getGlobalWeights()
    setFragments(rows.map(r => {
      const substats: SubstatEntry[] = JSON.parse(r.substats)
      return { ...r, substats, gs: calcGearScore(substats, weights) }
    }))
    setLoading(false)
  }

  async function deleteFragment(id: number) {
    const db = await getDb()
    await db.execute("DELETE FROM fragments WHERE id = ?", [id])
    setFragments(prev => prev.filter(f => f.id !== id))
  }

  const displayed = slotFilter ? fragments.filter(f => f.slot === slotFilter) : fragments

  if (loading) return <div className="flex items-center justify-center h-full text-[#b3b3b3]">Loading…</div>

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-xl font-bold text-white p-4">Fragments</h1>

      {/* Slot filter */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
        <button
          onClick={() => setSlotFilter(null)}
          className={`px-3 py-1 rounded-full text-xs ${!slotFilter ? "bg-[#c084fc] text-white" : "bg-[#282828] text-[#b3b3b3]"}`}
        >All</button>
        {[1,2,3,4,5,6].map(s => (
          <button
            key={s}
            onClick={() => setSlotFilter(s)}
            className={`px-3 py-1 rounded-full text-xs ${slotFilter === s ? "bg-[#c084fc] text-white" : "bg-[#282828] text-[#b3b3b3]"}`}
          >{SLOT_LABELS[s]}</button>
        ))}
      </div>

      {displayed.length === 0
        ? <div className="flex items-center justify-center flex-1 text-[#b3b3b3] text-sm">No fragments.</div>
        : (
          <div className="flex-1 overflow-y-auto divide-y divide-[#282828]">
            {displayed.map(f => (
              <div key={f.id} className="flex items-start gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-[#282828] text-[#b3b3b3] px-1.5 rounded">
                      {SLOT_LABELS[f.slot]}
                    </span>
                    <p className="text-white font-semibold truncate text-sm">{f.name}</p>
                  </div>
                  <p className="text-xs text-[#b3b3b3]">{f.set_name} · {f.rarity} · +{f.upgrade}</p>
                  <p className="text-xs text-[#c084fc] font-mono">GS {f.gs.toFixed(1)}</p>
                </div>
                <button
                  onClick={() => deleteFragment(f.id)}
                  className="text-xs text-red-400 px-2 py-1 rounded mt-1"
                >Delete</button>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src-mobile/pages/FragmentsPage.tsx
git commit -m "feat(mobile): add FragmentsPage with slot filter and gear score"
```

---

## Task 17: RescuePage

**Files:**
- Create: `src-mobile/pages/RescuePage.tsx`

- [ ] **Step 1: Create RescuePage.tsx**

```tsx
import { useEffect, useState } from "react"
import { getDb } from "../lib/db"
import type { DbRescuePull } from "../lib/types"

export function RescuePage() {
  const [pulls, setPulls] = useState<DbRescuePull[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const db = await getDb()
    const rows = await db.select<DbRescuePull[]>(
      "SELECT * FROM rescue_pulls ORDER BY rescue_time DESC"
    )
    setPulls(rows)
    setLoading(false)
  }

  async function deletePull(id: number) {
    const db = await getDb()
    await db.execute("DELETE FROM rescue_pulls WHERE id = ?", [id])
    setPulls(prev => prev.filter(p => p.id !== id))
  }

  // Group by banner
  const byBanner = pulls.reduce<Record<string, DbRescuePull[]>>((acc, p) => {
    if (!acc[p.banner_name]) acc[p.banner_name] = []
    acc[p.banner_name].push(p)
    return acc
  }, {})

  if (loading) return <div className="flex items-center justify-center h-full text-[#b3b3b3]">Loading…</div>
  if (pulls.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-[#b3b3b3]">
      <p>No rescue records yet.</p>
      <p className="text-xs">Capture the Rescue Records screen in-game.</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-xl font-bold text-white p-4">Rescue Records</h1>
      <div className="flex-1 overflow-y-auto">
        {Object.entries(byBanner).map(([banner, bannerPulls]) => (
          <div key={banner}>
            <div className="px-4 py-2 bg-[#181818] border-b border-[#282828]">
              <p className="text-sm font-semibold text-[#c084fc]">{banner}</p>
              <p className="text-xs text-[#b3b3b3]">{bannerPulls.length} pulls</p>
            </div>
            {bannerPulls.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a]">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{p.char_name}</p>
                  <p className="text-xs text-[#b3b3b3]">{p.type} · {p.rescue_time}</p>
                </div>
                <button
                  onClick={() => deletePull(p.id)}
                  className="text-xs text-red-400 px-2 py-1 rounded"
                >Delete</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src-mobile/pages/RescuePage.tsx
git commit -m "feat(mobile): add RescuePage grouped by banner"
```

---

## Task 18: OptimizerPage

**Files:**
- Create: `src-mobile/pages/OptimizerPage.tsx`

- [ ] **Step 1: Create OptimizerPage.tsx**

```tsx
import { useEffect, useState } from "react"
import { getDb, getGlobalWeights } from "../lib/db"
import { optimize } from "../lib/optimizer"
import { calcGearScore } from "../lib/scoring"
import type { DbFragment, DbCombatant, SubstatEntry } from "../lib/types"

const SLOT_LABELS = ["", "I", "II", "III", "IV", "V", "VI"]

export function OptimizerPage() {
  const [combatants, setCombatants] = useState<DbCombatant[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [result, setResult] = useState<Record<number, (DbFragment & { gs: number }) | null>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getDb().then(db =>
      db.select<DbCombatant[]>("SELECT * FROM combatants ORDER BY name").then(setCombatants)
    )
  }, [])

  async function runOptimizer() {
    if (!selectedId) return
    setLoading(true)
    const db = await getDb()
    const rows = await db.select<(Omit<DbFragment, "substats"> & { substats: string })[]>(
      "SELECT * FROM fragments"
    )
    const fragments: DbFragment[] = rows.map(r => ({
      ...r,
      substats: JSON.parse(r.substats) as SubstatEntry[],
    }))
    const weights = await getGlobalWeights()
    const optimized = optimize(fragments, weights)
    const withGs: Record<number, (DbFragment & { gs: number }) | null> = {}
    for (const [slot, frag] of Object.entries(optimized)) {
      withGs[Number(slot)] = frag
        ? { ...frag, gs: calcGearScore(frag.substats, weights) }
        : null
    }
    setResult(withGs)
    setLoading(false)
  }

  const selectedChar = combatants.find(c => c.char_id === selectedId)

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-xl font-bold text-white p-4">Optimizer</h1>

      <div className="px-4 pb-4 space-y-3">
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="w-full bg-[#282828] border border-[#333] rounded px-3 py-2 text-white text-sm outline-none"
        >
          <option value="">Select a combatant…</option>
          {combatants.map(c => (
            <option key={c.char_id} value={c.char_id}>{c.name}</option>
          ))}
        </select>

        <button
          onClick={runOptimizer}
          disabled={!selectedId || loading}
          className="w-full py-2 bg-[#c084fc] text-white rounded font-semibold disabled:opacity-40"
        >
          {loading ? "Optimizing…" : "Optimize"}
        </button>
      </div>

      {Object.keys(result).length > 0 && (
        <div className="flex-1 overflow-y-auto divide-y divide-[#282828]">
          {[1,2,3,4,5,6].map(slot => {
            const frag = result[slot]
            return (
              <div key={slot} className="flex items-center gap-3 p-4">
                <span className="text-xs bg-[#282828] text-[#b3b3b3] px-2 py-1 rounded w-8 text-center">
                  {SLOT_LABELS[slot]}
                </span>
                {frag ? (
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{frag.name}</p>
                    <p className="text-xs text-[#b3b3b3]">{frag.set_name} · +{frag.upgrade}</p>
                    <p className="text-xs text-[#c084fc] font-mono">GS {frag.gs.toFixed(1)}</p>
                  </div>
                ) : (
                  <p className="text-[#b3b3b3] text-sm italic">No fragment captured for this slot</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src-mobile/pages/OptimizerPage.tsx
git commit -m "feat(mobile): add OptimizerPage"
```

---

## Task 19: ScoringPage

**Files:**
- Create: `src-mobile/pages/ScoringPage.tsx`

- [ ] **Step 1: Create ScoringPage.tsx**

```tsx
import { useEffect, useState } from "react"
import { getDb, saveWeights } from "../lib/db"
import type { DbCombatant } from "../lib/types"

const ALL_STATS = [
  "Attack", "Defense", "Health",
  "Critical Chance", "Critical Damage",
  "Speed", "Resistance", "Accuracy",
]

const DPS_DEFAULTS: Record<string, number> = {
  Attack: 5, "Critical Chance": 8, "Critical Damage": 8,
  Defense: 1, Health: 1, Speed: 3, Resistance: 1, Accuracy: 1,
}

const TANK_DEFAULTS: Record<string, number> = {
  Defense: 8, Health: 8, Resistance: 5,
  Attack: 1, "Critical Chance": 1, "Critical Damage": 1, Speed: 3, Accuracy: 1,
}

const DEFAULT_WEIGHTS = ALL_STATS.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: 1 }), {})

export function ScoringPage() {
  const [combatants, setCombatants] = useState<DbCombatant[]>([])
  // "" = global mode; char_id = per-character override
  const [selectedChar, setSelectedChar] = useState<string>("")
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    getDb().then(db =>
      db.select<DbCombatant[]>("SELECT * FROM combatants ORDER BY name").then(setCombatants)
    )
    loadWeights("")
  }, [])

  async function loadWeights(charId: string) {
    const db = await getDb()
    const isGlobal = charId === ""
    const rows = await db.select<{ weights: string }[]>(
      `SELECT weights FROM scoring_weights WHERE char_id ${isGlobal ? "IS NULL" : "= ?"} LIMIT 1`,
      isGlobal ? [] : [charId]
    )
    if (rows.length > 0) {
      setWeights(JSON.parse(rows[0].weights))
    } else if (!isGlobal) {
      // No per-char override yet — fall back to global weights
      loadWeights("")
    } else {
      setWeights({ ...DEFAULT_WEIGHTS })
    }
  }

  async function handleCharChange(charId: string) {
    setSelectedChar(charId)
    await loadWeights(charId)
  }

  async function handleSave() {
    const allZero = ALL_STATS.every(s => (weights[s] ?? 0) === 0)
    if (allZero) return
    setSaving(true)
    await saveWeights(selectedChar === "" ? null : selectedChar, weights)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function applyPreset(preset: "dps" | "tank") {
    setWeights(preset === "dps" ? { ...DPS_DEFAULTS } : { ...TANK_DEFAULTS })
  }

  const allZero = ALL_STATS.every(s => (weights[s] ?? 0) === 0)

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-xl font-bold text-white p-4">Scoring Weights</h1>

      {/* Character selector (global vs per-char override) */}
      <div className="px-4 pb-3">
        <select
          value={selectedChar}
          onChange={e => handleCharChange(e.target.value)}
          className="w-full bg-[#282828] border border-[#333] rounded px-3 py-2 text-white text-sm outline-none"
        >
          <option value="">Global weights</option>
          {combatants.map(c => (
            <option key={c.char_id} value={c.char_id}>{c.name}</option>
          ))}
        </select>
        {selectedChar && (
          <p className="text-xs text-[#b3b3b3] mt-1">
            Override for {combatants.find(c => c.char_id === selectedChar)?.name ?? selectedChar}.
            Leave all sliders and hit Save to store.
          </p>
        )}
      </div>

      {/* Presets */}
      <div className="flex gap-2 px-4 pb-4">
        <button onClick={() => applyPreset("dps")}
          className="flex-1 py-1.5 bg-[#282828] text-[#c084fc] text-sm rounded font-medium">DPS</button>
        <button onClick={() => applyPreset("tank")}
          className="flex-1 py-1.5 bg-[#282828] text-[#b3b3b3] text-sm rounded font-medium">Tank</button>
      </div>

      {/* Sliders */}
      <div className="flex-1 overflow-y-auto px-4 space-y-4">
        {ALL_STATS.map(stat => (
          <div key={stat}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-white">{stat}</span>
              <span className="text-sm font-mono text-[#c084fc]">{weights[stat] ?? 0}</span>
            </div>
            <input
              type="range" min={0} max={10} step={1}
              value={weights[stat] ?? 0}
              onChange={e => setWeights(prev => ({ ...prev, [stat]: Number(e.target.value) }))}
              className="w-full accent-[#c084fc]"
            />
          </div>
        ))}
      </div>

      <div className="p-4">
        {allZero && (
          <p className="text-xs text-red-400 text-center mb-2">At least one weight must be greater than 0</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving || allZero}
          className="w-full py-2.5 bg-[#c084fc] text-white rounded font-semibold disabled:opacity-40"
        >
          {saved ? "Saved!" : saving ? "Saving…" : "Save Weights"}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src-mobile/pages/ScoringPage.tsx
git commit -m "feat(mobile): add ScoringPage with weight sliders"
```

---

## Task 20: App.mobile.tsx Navigation + APK Build

**Files:**
- Create: `src-mobile/App.mobile.tsx`

- [ ] **Step 1: Create App.mobile.tsx**

```tsx
import { useState } from "react"
import { CapturePage }    from "./pages/CapturePage"
import { CombatantsPage } from "./pages/CombatantsPage"
import { FragmentsPage }  from "./pages/FragmentsPage"
import { RescuePage }     from "./pages/RescuePage"
import { OptimizerPage }  from "./pages/OptimizerPage"
import { ScoringPage }    from "./pages/ScoringPage"

type Tab = "capture" | "combatants" | "fragments" | "rescue" | "optimizer" | "scoring"

const TABS: { id: Tab; label: string }[] = [
  { id: "capture",    label: "Capture"    },
  { id: "combatants", label: "Chars"      },
  { id: "fragments",  label: "Fragments"  },
  { id: "rescue",     label: "Rescue"     },
  { id: "optimizer",  label: "Optimizer"  },
  { id: "scoring",    label: "Scoring"    },
]

export function AppMobile() {
  const [activeTab, setActiveTab] = useState<Tab>("capture")

  return (
    <div className="flex flex-col h-screen bg-[#0e0e0e] text-white">
      <div className="flex-1 overflow-hidden">
        {activeTab === "capture"    && <CapturePage />}
        {activeTab === "combatants" && <CombatantsPage />}
        {activeTab === "fragments"  && <FragmentsPage />}
        {activeTab === "rescue"     && <RescuePage />}
        {activeTab === "optimizer"  && <OptimizerPage />}
        {activeTab === "scoring"    && <ScoringPage />}
      </div>

      {/* Bottom tab bar */}
      <div className="flex border-t border-[#282828] bg-[#141414] pb-safe">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-[10px] font-medium transition-colors ${
              activeTab === tab.id
                ? "text-[#c084fc]"
                : "text-[#666666]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests one final time**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 3: Build the Android APK**

```bash
npx tauri android build
```

Expected: APK generated at `android/app/build/outputs/apk/universal/release/` or similar path.

- [ ] **Step 4: Install on device**

```bash
# Connect Android device via USB with USB debugging enabled
adb install -r android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

Or use Android Studio's device manager to install the APK directly.

- [ ] **Step 5: Smoke test on device**
  - App opens and shows bottom tab bar
  - Tap Capture → permission dialog appears → allow
  - Open game's Rescue Records → tap Capture in app → toast confirms pulls saved
  - Open game's fragment detail → tap Capture → toast confirms fragment saved
  - Open game's character Stats tab → tap Capture → toast confirms combatant saved
  - Navigate to Rescue Records tab → saved pulls appear grouped by banner
  - Navigate to Fragments tab → saved fragments appear with gear scores
  - Navigate to Scoring → adjust weights and save → fragment GS values update

- [ ] **Step 6: Commit**

```bash
git add src-mobile/App.mobile.tsx
git commit -m "feat(mobile): add AppMobile navigation — Tauri Android app complete"
```
