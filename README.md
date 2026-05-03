# Hub CZN — Chaos Zero Nightmare Optimizer

> Gear management, build optimization, rescue records and damage simulation for **Chaos Zero Nightmare** — inspired by [Fribbels Epic 7 Optimizer](https://github.com/fribbels/Fribbels-Epic-7-Optimizer).

A desktop app (Windows) that intercepts the game's network traffic to extract your inventory, rescue records and character data in real time — then helps you build the best gear sets for every combatant.

---

## Features

| Module | What it does |
|---|---|
| **Setup** | Installs mitmproxy and the CA certificate needed for traffic interception |
| **Capture** | Starts the local proxy, captures inventory and rescue records live |
| **Memory Fragments** | Lists all your fragments with Gear Score, potential range and equipped status |
| **Optimizer** | Finds the best fragment combinations for any combatant based on your stat priorities |
| **Scoring** | Configure per-character or global stat weights used by the optimizer |
| **Combatants** | Full roster with level, attribute, class, Ego, gear score and equipped build details |
| **Rescue Records** | Complete gacha pull history with pity counters, banner stats and charts |
| **Card Library** | Browse all cards by character with coefficient, hits and spark variants |
| **Damage Simulator** | Simulate card damage against any enemy DEF using your equipped build |

---

## Requirements

- **Windows 10 / 11**
- **Administrator privileges** (required to redirect game traffic via hosts file)
- **mitmproxy** (the app offers one-click install)
- **Chaos Zero Nightmare** installed via the STOVE client

---

## Installation

1. Download the latest installer from the [Releases page](https://github.com/sostenesfreitas/hub-czn/releases)
2. Run `hub-czn_x.x.x_x64-setup.exe` — Windows may show a SmartScreen warning, click **More info → Run anyway**
3. Launch **Hub CZN** — right-click → **Run as administrator** (required for Capture to work)

---

## Step-by-Step Usage Guide

### 1 — First-Time Setup

The first time you run the app, go to the **Setup** tab and complete all three steps:

**Step 1 — mitmproxy**
- Click **Install** next to *mitmproxy*
- The app will download and install it automatically
- The status turns green when done

**Step 2 — CA Certificate**
- Click **Generate** next to *CA Certificate*
- This creates the certificate at `~/.mitmproxy/mitmproxy-ca-cert.cer`
- Click **Open certificate** to open the file

**Step 3 — Import Certificate into Windows**
- In the certificate window that opens: click **Install Certificate**
- Choose **Local Machine** → **Next**
- Select **Place all certificates in the following store** → **Browse** → choose **Trusted Root Certification Authorities** → **OK**
- Click **Finish**, then confirm in the app that you imported it

> You only need to do this once. The certificate allows mitmproxy to decrypt the game's HTTPS/WebSocket traffic locally — no data leaves your machine.

---

### 2 — Capturing Game Data

1. Open Hub CZN **as Administrator**
2. Go to the **Capture** tab
3. Click **Start Capture** — the proxy starts and the game traffic will be redirected
4. Open **Chaos Zero Nightmare** on your device / PC
5. In-game, navigate to:
   - **Memory Fragments** (inventory) — data is captured automatically as the screen loads
   - **Rescue Records** — data is captured automatically as you browse pages
6. When done, click **Stop Capture** in the app
7. Click **Load Latest** to load the captured snapshot into the optimizer

> You must be connected to the **same network** as the device running the game, or be playing on PC via the STOVE client.

---

### 3 — Auto-Scroll (Rescue Records)

Manually navigating all rescue record pages is tedious. Auto-Scroll clicks the **Next Page** button for you:

1. Start Capture
2. In-game, open **Rescue → Rescue Records** and go to the first page
3. In the app, click **Start Auto-Scroll**
4. A dialog will appear — position your mouse cursor over the **›** (next page) button in the game
5. Click **Start Auto-scroll** in the dialog — a 5-second countdown begins; **do not move the mouse**
6. The app will automatically click through all pages, collecting records
7. When done, the status shows how many pages and records were captured

---

### 4 — Memory Fragments (Inventory)

After loading data via **Load Latest**:

- The **Memory Fragments** tab lists all your gear with: Slot, Set, Level, Main stat, Substats, Gear Score (0–100), Potential range, and which combatant has it equipped
- Click column headers to sort
- Use the search/filter bar to narrow results

**Gear Score (GS)** measures how well each substat rolled relative to its maximum value. A score of 100 means every roll was perfect.

**Potential** shows the GS range after all remaining upgrade slots are filled (assuming worst vs. best rolls).

---

### 5 — Optimizer

1. Go to the **Optimizer** tab
2. Select a **Character** from the dropdown
3. Choose a **Set Bonus**: 4-piece, two 2-pieces, or Any
4. Select preferred **Main Stats** for Slots 4, 5 and 6
5. Adjust **Stat Priority** weights in the **Scoring** tab (higher weight = more important in the ranking)
6. Set **Top % gear** — lower values (e.g. 40%) make the search faster by excluding low-GS pieces
7. Set **Max Results** (how many builds to display)
8. Toggle **Include equipped gear** to also consider pieces already on other characters
9. Use **Exclude characters** to reserve gear from specific characters
10. Click **Optimize** — results appear ranked by total weighted Gear Score

Each result shows the full 6-piece build with individual GS values and the combined score. Click a result to see details.

---

### 6 — Scoring (Stat Weights)

The **Scoring** tab controls how the optimizer ranks builds:

- Switch between **Global** mode (applies to all characters) and **Character** mode (per-character override)
- Drag sliders or type values from **–1** to **3**:
  - `0` = stat is ignored
  - `1` = normal contribution
  - `2` = double weight
  - `–1` = penalise (avoid this stat)
- Use **System Rec.** to load the game's recommended preset for a character
- Click **Save** to persist your weights

---

### 7 — Combatants

The **Combatants** tab shows your full roster sorted by Gear Score:

- Each row shows: character icon, name, level, attribute (with icon), class, Ego level (E0–E6), and average GS
- Click any row to **expand** it and see:
  - All 6 equipped Memory Fragments with individual GS
  - Final calculated stats (ATK, DEF, HP, CRate, CDmg, etc.)
  - Partner skill badge

**Export JSON** — saves a full snapshot of all combatants and their gear to a `.json` file (opens a native save dialog)

**Save to Cloud** — opens [hub-czn.lovable.app](https://hub-czn.lovable.app) in your browser to back up data online

---

### 8 — Rescue Records

After capturing, go to the **Rescue Records** tab:

- Switch between banners using the tabs at the top
- **Stats panel**: Total pulls, resources spent, 5★/4★ counts, average pity
- **Pie chart**: Distribution of 3★/4★/5★ pulls
- **5★ portrait grid**: All 5-star pulls with their pity number (colour-coded)
- **Full history table**: Every pull with roll number, character, pity, banner and timestamp
  - Filter by rarity (All / 5★ / 4★)
  - Paginated (50 per page)

**Pity colour coding:**
| Colour | Range | Meaning |
|---|---|---|
| 🟢 Green | 1–25 | Safe zone |
| 🟡 Yellow | 26–50 | Approaching soft pity |
| 🟠 Orange | 51–65 | Soft pity active |
| 🔴 Red | 66–70 | Hard pity imminent |

**Export JSON** — saves all rescue records to a `.json` file

**Save to Cloud** — opens hub-czn.lovable.app to back up your pull history

---

### 9 — Card Library

Browse all character cards:

- Search by card name or ID
- Filter by character or card type (Damage / Support)
- Each card shows: thumbnail, cost, type, damage coefficient, hit count, and spark variant details

---

### 10 — Damage Simulator

Simulate how much damage your characters deal:

1. Go to the **Damage Simulator** tab
2. Select a **Character** — their equipped build is loaded automatically
3. Set **Morale** stacks
4. Choose a **Deck** (Auto picks the highest-scoring cards, or select slots manually)
5. Set **Monster DEF** — use the presets (World Level, Spiral Tower, Special Bosses)
6. Toggle **Buffs & Debuffs** (Weaken, Vulnerable, Damage Reduction)
7. Toggle **Apply Epiphany** to factor in spark bonuses
8. Click **Simulate** — results show Normal / Crit / Avg damage per card and totals

> The simulator uses the formula: `ATK × coefficient × crit_factor × morale_mult × buff_mult × (300 / (300 + DEF))`

---

## Building from Source

**Requirements:** Node.js 20+, Rust (stable), Python 3.11+

```bash
# Clone
git clone https://github.com/sostenesfreitas/hub-czn.git
cd hub-czn

# Install JS dependencies
npm install

# Install Python API dependencies
pip install -r api/requirements.txt

# Run in dev mode (starts Vite + Tauri + Python API)
# In one terminal: start the Python API
python -m api.main

# In another terminal:
npm run tauri dev

# Production build
npm run tauri build
# Output: src-tauri/target/release/bundle/
```

---

## Troubleshooting

**Capture doesn't intercept data**
- Make sure the app is running as **Administrator**
- Check that mitmproxy is installed (green in Setup)
- Check that the certificate is imported in **Trusted Root Certification Authorities**
- Restart the app and try again

**"API not connected" error**
- In dev mode, make sure the Python API is running separately (`python -m api.main`)
- In the installed app, this error means the sidecar failed to start — try running as Administrator

**SmartScreen warning on install**
- Click **More info** → **Run anyway** — the app is unsigned (no code signing certificate)

---

## Contributing

- Report bugs: [GitHub Issues](https://github.com/sostenesfreitas/hub-czn/issues)
- Pull requests welcome

## Credits

- Original optimizer concept: [Vorbroker](https://github.com/Vorbroker/Vribbels-CZN-Optimizer) (MIT)
- Inspired by [Fribbels Epic 7 Optimizer](https://github.com/fribbels/Fribbels-Epic-7-Optimizer)

## License

MIT — see [LICENSE](LICENSE).  
Chaos Zero Nightmare and all related assets are property of their respective owners. This tool is not affiliated with or endorsed by the game's developers.
