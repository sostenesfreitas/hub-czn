# Hub CZN — Chaos Zero Nightmare Optimizer

A gear management and optimization tool for the mobile game **Chaos Zero Nightmare**.  
Actively maintained fork of [Vribbels CZN Optimizer](https://github.com/Vorbroker/Vribbels-CZN-Optimizer) by Vorbroker (MIT).

## Features

### Memory Fragment Optimizer
- **Smart Build Optimization**: Automatically finds the best Memory Fragment combinations for your characters
- **Stat Priority Weighting**: Customize stat priorities to match your build goals
- **Set Bonus Support**: Filter by 2-piece and 4-piece set bonuses
- **Gear Score Calculation**: Evaluates fragments based on substats and potential
- **Top X% Filtering**: Reduce search time by focusing on the best fragments

### Inventory Management
- **Memory Fragments Tab**: View and filter all your equipped and unequipped fragments
- **Materials Tab**: Track your growth stone inventory
- **Combatants Tab**: View all characters with levels, gear scores, and stats

### Rescue Records
- **Pull History**: View your full gacha history captured from the game
- **Pity Tracking**: Export your pull history as JSON with per-banner pity counters
- **Live Updates**: Records accumulate automatically as you navigate pages in-game

### Data Capture
- **Integrated mitmproxy Setup**: Built-in proxy configuration for capturing game data
- **Automatic Data Extraction**: Captures Memory Fragments, character data, and inventory
- **Live Monitoring**: Equip, unequip, and upgrade without restarting capture

### Advanced Features
- **Potential Node Calculation**: Includes character progression bonuses
- **Partner Card Integration**: Calculates partner passive stat bonuses
- **Friendship Bonus Tracking**: Accounts for character friendship stats
- **Multi-Build Comparison**: Compare current vs. optimized builds side-by-side

## Installation

### Requirements
- Windows
- STOVE Client

### Quick Start

1. Download the latest release from the [Releases page](https://github.com/sostenesfreitas/hub-czn/releases)
2. Run `Vribbels_CZN_Optimizer.exe`
3. Navigate to the **Setup** tab and click **Generate & Install Cert**

## Building from Source

```bash
pip install -r requirements.txt
pyinstaller Vribbels_CZN_Optimizer.spec --clean --noconfirm
```

Or double-click `build.bat`.

## Usage

### Capturing Game Data

1. Launch the application (run as Administrator on Windows for capture functionality)
2. Navigate to the **Capture** tab
3. Click **"Start Capture"**
4. Launch Chaos Zero Nightmare and navigate to the main menu
5. Data loads automatically — keep capture running to see live updates

### Capturing Rescue Records

1. Start Capture
2. In-game, open the Rescue screen → **Rescue Records** tab
3. Navigate through all pages — records accumulate automatically
4. Open the **Rescue Records** tab in the app to view and export

### Optimizing Builds

1. Click **"Load Data"** and select your capture file
2. Select a combatant from the dropdown
3. Adjust **Stat Priorities** using the sliders (higher values = more important)
4. Select desired **Set Bonuses** (4-piece and/or 2-piece)
5. Choose **Main Stats** for slots 4, 5, and 6
6. Adjust **Top %** to control search space (lower = faster, fewer combinations)
7. Click **"Start"** to begin optimization

## Contributing

Contributions are welcome! Feel free to:
- Report bugs via [GitHub Issues](https://github.com/sostenesfreitas/hub-czn/issues)
- Submit character/partner data updates
- Suggest new features
- Improve documentation

## Credits

Originally created by [Vorbroker](https://github.com/Vorbroker/Vribbels-CZN-Optimizer)

Inspired by [Fribbels Epic 7 Gear Optimizer](https://github.com/fribbels/Fribbels-Epic-7-Optimizer)

## License

MIT License - see [LICENSE](LICENSE) file for details.

Chaos Zero Nightmare and all related assets are property of their respective owners.

---

**Note**: This is a third-party tool and is not affiliated with or endorsed by the developers of Chaos Zero Nightmare.
