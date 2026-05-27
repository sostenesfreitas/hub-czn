# Adelheid + Clara Game-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register Adelheid (combatant, res_id 1055) and Clara (partner, res_id 30095) into the optimizer's data tier; introduce reusable `extract_combatant.py` and `extract_partner.py` scripts so future game updates are paste-and-rebuild.

**Architecture:** Two new scripts read the unpacked client (`C:\Users\soste\Downloads\output\`) plus the localized `text/en/text.json`. They emit Python dict literals ready to paste into `api/game_data/characters.py::CHARACTERS` and `api/game_data/partners.py::PARTNERS`. After paste, existing pipeline scripts (`bundle_game_data.py`, `build_scaling_tables.py`, `copy_portraits.py`, `extract_characters.py`) regenerate all derived bundles.

**Key field-mapping decision:** for combatant *display* attributes (class, attribute, grade) the authoritative source is `char_base@char_base.json` (specifically `link_char_growth_material_id` of form `c_{classKey}_{colorKey}` and `rarity`). For *stats* (`s_atk` etc.) the authoritative source remains `char_base@char_combatant.json`. The two can disagree — e.g., Adelheid (1055) is `c_knight_purple` + `RARITY_SSR` (display: Vanguard / Void / SSR) but her `char_combatant` row still carries Controller-SR placeholder stats. We preserve both as-is and let `build_scaling_tables.py` continue reading stats from `char_combatant`.

**Tech Stack:** Python 3.11+, pytest, json stdlib, dataclasses-free (functions + dicts to match existing style).

**Spec:** `docs/superpowers/specs/2026-05-27-adelheid-clara-update-design.md`

---

### Task 0: Confirm working environment

**Files:** (verification only)

- [ ] **Step 1: Verify the game output exists**

Run:
```powershell
Test-Path "C:\Users\soste\Downloads\output\db\char_base@char_combatant.json"
Test-Path "C:\Users\soste\Downloads\output\db\partner_base@char_partner.json"
Test-Path "C:\Users\soste\Downloads\output\text\en\text.json"
```
Expected: `True` for all three.

- [ ] **Step 2: Verify Adelheid (1055) and Clara (30095) are present**

Run (PowerShell):
```powershell
Select-String -Path "C:\Users\soste\Downloads\output\text\en\text.json" -Pattern 'char_base@name@(1055|30095)' | Select-Object -First 4
```
Expected: 2+ matches showing `"text": "Adelheid"` and `"text": "Clara"`.

- [ ] **Step 3: Verify Python environment**

Run: `python -c "import pytest, json; print('ok')"`
Expected: `ok`

---

### Task 1: Create `extract_combatant.py` test harness with Yuki as oracle

**Files:**
- Create: `tests/scripts/test_extract_combatant.py`
- (Test only — no implementation yet)

- [ ] **Step 1: Write failing test that uses Yuki (1057) as ground truth**

Create `tests/scripts/__init__.py` (empty file) if it does not exist.

Create `tests/scripts/test_extract_combatant.py`:

```python
"""Tests for scripts/extract_combatant.py.

Strategy: run the extractor against res_ids whose CHARACTERS entries are
already known-good, then assert key fields match. If the game files were
re-extracted with the same content, output must equal CHARACTERS[res_id].
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from api.game_data.characters import CHARACTERS  # noqa: E402

OUTPUT_DIR = Path(r"C:\Users\soste\Downloads\output")


@pytest.fixture(scope="module")
def extractor():
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    import extract_combatant  # noqa: WPS433 (local import is fine here)
    return extract_combatant


def test_yuki_1057_round_trip(extractor):
    """Yuki: Order/Striker/grade 5 — anchor for c_striker_green."""
    entry = extractor.extract(OUTPUT_DIR, 1057)
    expected = CHARACTERS[1057]
    assert entry["name"] == expected["name"]
    assert entry["grade"] == expected["grade"]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]
    assert entry["base_atk"] == expected["base_atk"]
    assert entry["base_def"] == expected["base_def"]
    assert entry["base_hp"] == expected["base_hp"]


def test_nia_1003_round_trip(extractor):
    """Nia: Instinct/Controller/grade 4 — anchor for c_controller_orange."""
    entry = extractor.extract(OUTPUT_DIR, 1003)
    expected = CHARACTERS[1003]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]
    assert entry["grade"] == expected["grade"]


def test_khalipe_1008_round_trip(extractor):
    """Khalipe: Instinct/Vanguard/grade 5 — anchor for c_knight_orange, RARITY_SSR."""
    entry = extractor.extract(OUTPUT_DIR, 1008)
    expected = CHARACTERS[1008]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]
    assert entry["grade"] == expected["grade"]


def test_magna_1010_round_trip(extractor):
    """Magna: Justice/Vanguard — anchor for c_knight_blue (BLUE → Justice, NOT Adelheid's variant!)."""
    entry = extractor.extract(OUTPUT_DIR, 1010)
    expected = CHARACTERS[1010]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]


def test_rin_1018_round_trip(extractor):
    """Rin: Void/Striker — anchor for c_striker_purple."""
    entry = extractor.extract(OUTPUT_DIR, 1018)
    expected = CHARACTERS[1018]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]


def test_veronica_1033_round_trip(extractor):
    """Veronica: Passion/Ranger — anchor for c_ranger_red."""
    entry = extractor.extract(OUTPUT_DIR, 1033)
    expected = CHARACTERS[1033]
    assert entry["attribute"] == expected["attribute"]
    assert entry["class"] == expected["class"]


def test_adelheid_1055_is_vanguard_void_ssr(extractor):
    """Adelheid: display class+attr from char_base@char_base (c_knight_purple, RARITY_SSR)."""
    entry = extractor.extract(OUTPUT_DIR, 1055)
    required = {"name", "grade", "attribute", "class", "base_atk",
                "base_def", "base_hp", "base_crit_rate", "base_crit_dmg",
                "base_weak_ego_dmg_rate", "node_50", "node_60"}
    assert required.issubset(entry.keys())
    assert entry["name"] == "Adelheid"
    assert entry["class"] == "Vanguard"
    assert entry["attribute"] == "Void"
    assert entry["grade"] == 5
```

- [ ] **Step 2: Run test to verify it fails for the right reason**

Run: `pytest tests/scripts/test_extract_combatant.py -x 2>&1 | head -20`
Expected: FAIL with `ModuleNotFoundError: No module named 'extract_combatant'`.

- [ ] **Step 3: Commit**

```bash
git add tests/scripts/__init__.py tests/scripts/test_extract_combatant.py
git commit -m "test(extract_combatant): round-trip tests against known combatants"
```

---

### Task 2: Implement `scripts/extract_combatant.py`

**Files:**
- Create: `scripts/extract_combatant.py`

- [ ] **Step 1: Write the script**

Create `scripts/extract_combatant.py`:

```python
"""Auto-extract a combatant entry for api/game_data/characters.py::CHARACTERS.

Reads from the unpacked client (output/):
  - db/char_base@char_base.json — display class, attribute, grade (authoritative)
  - db/char_base@char_combatant.json — base stats (authoritative)
  - db/potential_node@potential_node_effect.json — node_50 / node_60 stat types
  - text/en/text.json — English combatant name

Usage:
    python scripts/extract_combatant.py <output_dir> <res_id> [<res_id> ...]

Example:
    python scripts/extract_combatant.py C:/Users/soste/Downloads/output 1055
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# link_char_growth_material_id is "c_{class_key}_{color_key}".
GROWTH_CLASS_TO_CLASS = {
    "controller": "Controller",
    "knight": "Vanguard",
    "striker": "Striker",
    "ranger": "Ranger",
    "hunter": "Hunter",
    "psionic": "Psionic",
}

GROWTH_COLOR_TO_ATTRIBUTE = {
    "orange": "Instinct",
    "blue": "Justice",
    "purple": "Void",
    "red": "Passion",
    "green": "Order",
}

RARITY_TO_GRADE = {
    "RARITY_SSR": 5,
    "RARITY_SR": 4,
    "RARITY_R": 3,
}

NODE_STAT_TYPE_TO_LABEL = {
    "hp_rate": "HP%",
    "atk_rate": "ATK%",
    "def_rate": "DEF%",
    "cri": "CRate",
    "cri_dmg_rate": "CDmg",
}


def _load_json(path: Path) -> list | dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _index_by_id(rows: list[dict]) -> dict[str, dict]:
    return {str(r["id"]): r for r in rows if "id" in r}


def _name_from_text_json(text_rows: list[dict], res_id: int) -> str | None:
    key = f"char_base@name@{res_id}"
    for row in text_rows:
        if row.get("id") == key:
            return row.get("text")
    return None


def _parse_growth_material(growth_id: str) -> tuple[str, str]:
    """Parse 'c_knight_purple' → ('Vanguard', 'Void')."""
    parts = growth_id.split("_")
    if len(parts) != 3 or parts[0] != "c":
        raise ValueError(f"unexpected link_char_growth_material_id: {growth_id!r}")
    klass = GROWTH_CLASS_TO_CLASS.get(parts[1])
    if klass is None:
        raise ValueError(f"unmapped class key in {growth_id!r}: {parts[1]!r}")
    attr = GROWTH_COLOR_TO_ATTRIBUTE.get(parts[2])
    if attr is None:
        raise ValueError(f"unmapped color key in {growth_id!r}: {parts[2]!r}")
    return klass, attr


def _resolve_node(node_effects: list[dict], res_id: int, node_num: int) -> str | None:
    """Find the stat type for a specific potential node (e.g. 50 or 60).

    Node id format: {res_id}{2-digit-node-num}{2-digit-level}. Any level row
    works — they share the stat type within a node.
    """
    prefix = f"{res_id}{node_num:02d}"
    for row in node_effects:
        nid = str(row.get("id", ""))
        if not nid.startswith(prefix):
            continue
        stat_type = row.get("stat_type") or row.get("stat_key") or ""
        label = NODE_STAT_TYPE_TO_LABEL.get(stat_type.lower())
        if label:
            return label
    return None


def extract(output_dir: Path, res_id: int) -> dict:
    db = output_dir / "db"
    text_json = output_dir / "text" / "en" / "text.json"

    char_base = _index_by_id(_load_json(db / "char_base@char_base.json"))
    combatants = _index_by_id(_load_json(db / "char_base@char_combatant.json"))
    text_rows = _load_json(text_json)
    node_effects = _load_json(db / "potential_node@potential_node_effect.json")

    base_row = char_base.get(str(res_id))
    if base_row is None:
        raise KeyError(f"res_id {res_id} not found in char_base@char_base.json")
    stat_row = combatants.get(str(res_id))
    if stat_row is None:
        raise KeyError(f"res_id {res_id} not found in char_base@char_combatant.json")

    name = _name_from_text_json(text_rows, res_id)
    if name is None:
        raise KeyError(f"no English name for res_id {res_id} in text.json")

    klass, attribute = _parse_growth_material(base_row["link_char_growth_material_id"])

    grade = RARITY_TO_GRADE.get(base_row["rarity"])
    if grade is None:
        raise ValueError(f"unmapped rarity: {base_row['rarity']!r}")

    entry = {
        "name": name,
        "grade": grade,
        "attribute": attribute,
        "class": klass,
        "base_atk": int(stat_row["s_atk"]),
        "base_def": int(stat_row["s_def"]),
        "base_hp": int(stat_row["s_hp"]),
        "base_crit_rate": float(stat_row["s_cri"]),
        "base_crit_dmg": float(stat_row["s_cri_dmg_rate"]),
        "base_weak_ego_dmg_rate": float(stat_row["s_weak_ego_dmg_rate"]),
        "node_50": _resolve_node(node_effects, res_id, 50),
        "node_60": _resolve_node(node_effects, res_id, 60),
    }
    return entry


def _format_entry(res_id: int, entry: dict) -> str:
    """Render entry as a paste-ready Python dict literal."""
    lines = [f"    {res_id}: {{"]
    for key in ("name", "grade", "attribute", "class", "base_atk", "base_def",
                "base_hp", "base_crit_rate", "base_crit_dmg",
                "base_weak_ego_dmg_rate", "node_50", "node_60"):
        value = entry[key]
        lines.append(f"        {key!r}: {value!r},")
    lines.append("    },")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("Usage: python scripts/extract_combatant.py <output_dir> <res_id> [<res_id> ...]",
              file=sys.stderr)
        return 2
    output_dir = Path(argv[1])
    for raw in argv[2:]:
        res_id = int(raw)
        entry = extract(output_dir, res_id)
        print(_format_entry(res_id, entry))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

- [ ] **Step 2: Run the tests**

Run: `pytest tests/scripts/test_extract_combatant.py -v 2>&1 | tail -30`
Expected: all 6 tests PASS.

- [ ] **Step 3: If any anchor test fails, fix mapping table**

If any of the round-trip tests fails, one of `GROWTH_CLASS_TO_CLASS`, `GROWTH_COLOR_TO_ATTRIBUTE`, or `RARITY_TO_GRADE` is wrong. Read the failing assertion to see which mapping is off, fix the table, and re-run. Do NOT change the test expectation — the existing `CHARACTERS` dict is the source of truth.

- [ ] **Step 4: Smoke run for Adelheid**

Run: `python scripts/extract_combatant.py C:/Users/soste/Downloads/output 1055`
Expected: stdout shows a paste-ready dict literal starting with `1055: {`, with `"name": 'Adelheid'`, `"attribute": 'Void'`, `"class": 'Vanguard'`, `"grade": 5`.

- [ ] **Step 5: Commit**

```bash
git add scripts/extract_combatant.py
git commit -m "feat(scripts): add extract_combatant.py for paste-ready CHARACTERS entries"
```

---

### Task 3: Paste Adelheid (1055) into `CHARACTERS`

**Files:**
- Modify: `api/game_data/characters.py` (insert new entry inside `CHARACTERS = {...}`, keep dict sorted by res_id)

- [ ] **Step 1: Capture the script output**

Run: `python scripts/extract_combatant.py C:/Users/soste/Downloads/output 1055 > _adel.txt`
Then `Get-Content _adel.txt` to inspect.

- [ ] **Step 2: Insert into `CHARACTERS`**

Open `api/game_data/characters.py` and insert the captured block between entry `1052` and `1056` (the existing entries on either side of `1055`). Maintain trailing comma and indentation matching surrounding entries.

- [ ] **Step 3: Smoke import**

Run: `python -c "from api.game_data.characters import CHARACTERS; c = CHARACTERS[1055]; print(c['name'], c['attribute'], c['class'], c['grade'])"`
Expected: `Adelheid Void Vanguard 5`

- [ ] **Step 4: Verify name reverse-lookup**

Run: `python -c "from api.game_data.characters import get_character_by_name; print(get_character_by_name('Adelheid')['base_atk'])"`
Expected: `129`

- [ ] **Step 5: Clean up temp file and commit**

```powershell
Remove-Item _adel.txt
```
```bash
git add api/game_data/characters.py
git commit -m "feat(characters): register Adelheid (1055) — Void Vanguard SSR"
```

---

### Task 4: Create `extract_partner.py` test harness with Ivy as oracle

**Files:**
- Create: `tests/scripts/test_extract_partner.py`

- [ ] **Step 1: Write failing test using Ivy (1025) and Gaya (20002) as oracles**

Create `tests/scripts/test_extract_partner.py`:

```python
"""Tests for scripts/extract_partner.py.

extract_partner.py is *assisted* extraction: it auto-resolves stats,
grade, class and ego_name/cost from the DB, but emits passive_desc and
values as a best-effort scaffold for human review. Tests assert only the
auto-resolved fields.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from api.game_data.partners import PARTNERS  # noqa: E402

OUTPUT_DIR = Path(r"C:\Users\soste\Downloads\output")


@pytest.fixture(scope="module")
def extractor():
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    import extract_partner  # noqa: WPS433
    return extract_partner


def test_ivy_1025_class_and_grade(extractor):
    """Ivy: Psionic / grade 5 — anchor for s_psionic → Psionic, RARITY_SSR → 5."""
    entry = extractor.extract(OUTPUT_DIR, 1025)
    expected = PARTNERS[1025]
    assert entry["name"] == expected["name"]
    assert entry["class"] == expected["class"]
    assert entry["grade"] == expected["grade"]


def test_solia_1058_class_and_grade(extractor):
    """Solia: Ranger / grade 5 — anchor for s_ranger → Ranger."""
    entry = extractor.extract(OUTPUT_DIR, 1058)
    expected = PARTNERS[1058]
    assert entry["name"] == expected["name"]
    assert entry["class"] == expected["class"]


def test_arwen_20001_class_and_grade(extractor):
    """Arwen: Controller / grade 4 — anchor for s_controller → Controller, RARITY_SR → 4."""
    entry = extractor.extract(OUTPUT_DIR, 20001)
    expected = PARTNERS[20001]
    assert entry["class"] == expected["class"]
    assert entry["grade"] == expected["grade"]


def test_clara_30095_emits_required_fields(extractor):
    """Clara: should emit all required PARTNERS fields, even if values are scaffolded."""
    entry = extractor.extract(OUTPUT_DIR, 30095)
    required = {"name", "grade", "class", "passive_name", "passive_desc",
                "values", "stats", "ego_name", "ego_cost", "ego_desc"}
    assert required.issubset(entry.keys())
    assert entry["name"] == "Clara"
    # Clara is a Knight-class partner per partner_base@char_partner.json
    assert entry["class"] == "Vanguard"
```

- [ ] **Step 2: Run test to verify it fails for the right reason**

Run: `pytest tests/scripts/test_extract_partner.py -x 2>&1 | head -20`
Expected: FAIL with `ModuleNotFoundError: No module named 'extract_partner'`.

- [ ] **Step 3: Commit**

```bash
git add tests/scripts/test_extract_partner.py
git commit -m "test(extract_partner): anchor tests against known partners"
```

---

### Task 5: Implement `scripts/extract_partner.py`

**Files:**
- Create: `scripts/extract_partner.py`

- [ ] **Step 1: Write the script**

Create `scripts/extract_partner.py`:

```python
"""Auto-extract a partner entry for api/game_data/partners.py::PARTNERS.

This is *assisted* extraction. Class, grade, name, ego_name and ego_cost
are auto-resolved. passive_name / passive_desc / values / stats / ego_desc
are emitted as a best-effort scaffold marked with `# TODO: review` so the
human curator can polish before paste.

Usage:
    python scripts/extract_partner.py <output_dir> <res_id> [<res_id> ...]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

GROWTH_MATERIAL_TO_CLASS = {
    "s_controller": "Controller",
    "s_hunter": "Hunter",
    "s_ranger": "Ranger",
    "s_striker": "Striker",
    "s_knight": "Vanguard",
    "s_psionic": "Psionic",
}

RARITY_TO_GRADE = {
    "RARITY_SSR": 5,
    "RARITY_SR": 4,
    "RARITY_R": 3,
}


def _load_json(path: Path) -> list | dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _index_by_id(rows: list[dict]) -> dict[str, dict]:
    return {str(r["id"]): r for r in rows if "id" in r}


def _name_from_text_json(text_rows: list[dict], res_id: int) -> str | None:
    key = f"char_base@name@{res_id}"
    for row in text_rows:
        if row.get("id") == key:
            return row.get("text")
    return None


def _text_lookup(text_rows: list[dict], key: str) -> str | None:
    for row in text_rows:
        if row.get("id") == key:
            return row.get("text")
    return None


def extract(output_dir: Path, res_id: int) -> dict:
    db = output_dir / "db"
    text_json = output_dir / "text" / "en" / "text.json"

    char_base = _index_by_id(_load_json(db / "partner_base@char_base.json"))
    char_partner = _index_by_id(_load_json(db / "partner_base@char_partner.json"))
    text_rows = _load_json(text_json)

    base_row = char_base.get(str(res_id))
    partner_row = char_partner.get(str(res_id))
    if base_row is None or partner_row is None:
        raise KeyError(f"res_id {res_id} missing from partner_base tables")

    name = _name_from_text_json(text_rows, res_id)
    if name is None:
        raise KeyError(f"no English name for partner res_id {res_id}")

    growth = base_row.get("link_char_growth_material_id", "")
    klass = GROWTH_MATERIAL_TO_CLASS.get(growth)
    if klass is None:
        raise ValueError(f"unmapped growth material: {growth!r}")

    grade = RARITY_TO_GRADE.get(base_row.get("rarity", ""))
    if grade is None:
        raise ValueError(f"unmapped rarity: {base_row.get('rarity')!r}")

    # Passive scaffold — locate passive group and link to skill_eff if possible.
    passive_group = partner_row.get("link_partner_passive_group", "")
    passive_name_key = f"partner_passive@name@{passive_group}"
    passive_desc_key = f"partner_passive@desc@{passive_group}"
    passive_name = _text_lookup(text_rows, passive_name_key) or "TODO: passive name"
    passive_desc = _text_lookup(text_rows, passive_desc_key) or "TODO: passive desc"

    # EGO / CS card scaffold.
    cs_link = partner_row.get("link_card_id", "")
    ego_name_key = f"card@name@{cs_link}"
    ego_desc_key = f"card@desc@{cs_link}"
    ego_name = _text_lookup(text_rows, ego_name_key) or "TODO: ego name"
    ego_desc = _text_lookup(text_rows, ego_desc_key) or "TODO: ego desc"

    entry = {
        "name": name,
        "grade": grade,
        "class": klass,
        "passive_name": passive_name,
        "passive_desc": passive_desc,
        "values": {},
        "stats": {},
        "ego_name": ego_name,
        "ego_cost": 3,  # default; review against card@cost
        "ego_desc": ego_desc,
    }
    return entry


def _format_entry(res_id: int, entry: dict) -> str:
    """Render entry as a paste-ready Python dict literal with review hints."""
    lines = [f"    {res_id}: {{  # TODO: review passive_desc, values, stats, ego_cost, ego_desc"]
    for key in ("name", "grade", "class", "passive_name", "passive_desc",
                "values", "stats", "ego_name", "ego_cost", "ego_desc"):
        value = entry[key]
        lines.append(f"        {key!r}: {value!r},")
    lines.append("    },")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("Usage: python scripts/extract_partner.py <output_dir> <res_id> [<res_id> ...]",
              file=sys.stderr)
        return 2
    output_dir = Path(argv[1])
    for raw in argv[2:]:
        res_id = int(raw)
        entry = extract(output_dir, res_id)
        print(_format_entry(res_id, entry))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

- [ ] **Step 2: Run the tests**

Run: `pytest tests/scripts/test_extract_partner.py -v 2>&1 | tail -30`
Expected: 4 PASS.

- [ ] **Step 3: Smoke run for Clara**

Run: `python scripts/extract_partner.py C:/Users/soste/Downloads/output 30095`
Expected: paste-ready dict literal beginning `30095: {  # TODO: review ...` containing `"name": 'Clara'`, `"class": 'Vanguard'`, `"grade": 5`.

- [ ] **Step 4: Commit**

```bash
git add scripts/extract_partner.py
git commit -m "feat(scripts): add extract_partner.py (assisted scaffold for PARTNERS entries)"
```

---

### Task 6: Paste Clara (30095) into `PARTNERS` and curate

**Files:**
- Modify: `api/game_data/partners.py`

- [ ] **Step 1: Capture extractor output**

Run: `python scripts/extract_partner.py C:/Users/soste/Downloads/output 30095 > _clara.txt`
Open `_clara.txt`.

- [ ] **Step 2: Insert into `PARTNERS`**

Open `api/game_data/partners.py`. Locate the existing entries and insert the `30095: { ... }` block at the matching numeric sort position. Maintain comma and indentation conventions.

- [ ] **Step 3: Hand-curate `passive_desc`, `values`, `stats`, `ego_cost`, `ego_desc`**

The auto-extraction emits these as TODO placeholders. To fill them:

1. Open `C:\Users\soste\Downloads\output\db\partner_passive@partner_passive.json` and find the row whose `id` matches Clara's `link_partner_passive_group` (the script printed it; usually `tactic_passive_30095`). Note `link_skill_eff_id` (a list).
2. Open `C:\Users\soste\Downloads\output\db\partner_passive@skill_eff.json` and find each linked effect. Each effect has 5 rows (levels 1–5) with `eff_value`. Group by token name (use `eff_key` / placeholder name).
3. Build the `values` dict: `{TokenName: (v1, v2, v3, v4, v5)}`. Use existing partners in `partners.py` as style reference (e.g., `Ivy 1025` for `ATK%` and `NextCardDMG%`).
4. `stats` is the subset of `values` that are direct stat bonuses (`ATK%`, `DEF%`, `HP%`, `CRate%`, `CDmg%`).
5. `passive_desc`: take the localized desc from text.json and replace inline tooltips like `<cc>30</>` with `{TokenName%}` placeholders matching `values`.
6. `ego_cost`: look up the cost field in `cs(partner)@cs.json` for Clara's `link_card_id` (was `p_30095`). The numeric `cost` field is the value.
7. `ego_desc`: rewrite into the concise 2-line form used by other entries (e.g., `"250% Damage\nMark 1"`). Use the in-game tooltip as reference.

Remove the `# TODO: review ...` comment once curated.

- [ ] **Step 4: Smoke import**

Run: `python -c "from api.game_data.partners import PARTNERS; p = PARTNERS[30095]; print(p['name'], p['class'], p['grade'], list(p['values'].keys()))"`
Expected: prints `Clara Vanguard 5 [...]` where `[...]` is the curated token list.

- [ ] **Step 5: Clean up and commit**

```powershell
Remove-Item _clara.txt
```
```bash
git add api/game_data/partners.py
git commit -m "feat(partners): register Clara (30095) — SSR Vanguard partner"
```

---

### Task 7: Regenerate `game_db.json`

**Files:**
- Regenerated: `api/data/game_db.json`

- [ ] **Step 1: Run bundle script**

Run: `python scripts/bundle_game_data.py C:/Users/soste/Downloads/output`
Expected: stdout shows `Loading card data… X cards…`, `Loading character base stats… N characters` (N is greater than before), `Wrote api/data/game_db.json (Y MB)`.

- [ ] **Step 2: Verify 1055 and 30095 are in the bundle**

Run:
```powershell
python -c "import json; db = json.loads(open('api/data/game_db.json', encoding='utf-8').read()); print('1055' in db['char_base'], '30095' in db['char_base'])"
```
Expected: `True True`.

- [ ] **Step 3: Commit**

```bash
git add api/data/game_db.json
git commit -m "data: regenerate game_db.json from updated client (Adelheid + Clara)"
```

---

### Task 8: Regenerate scaling tables

**Files:**
- Regenerated: `api/data/char_base_l1.json`, `api/data/level_scaling.json`

- [ ] **Step 1: Run scaling rebuild**

Run: `python scripts/build_scaling_tables.py`
Expected: stdout summarizes characters processed; `char_base_l1.json` and `level_scaling.json` updated.

- [ ] **Step 2: Verify Adelheid present in scaling**

Run:
```powershell
python -c "import json; d = json.loads(open('api/data/char_base_l1.json', encoding='utf-8').read()); print(d.get('1055'))"
```
Expected: a dict containing `atk`, `def`, `hp`, `cri`, `cri_dmg`, `weak_ego_dmg_rate`, `level_group`, `ascend_group`, `limit_break_group`, `friendship_group`.

- [ ] **Step 3: Commit**

```bash
git add api/data/char_base_l1.json api/data/level_scaling.json
git commit -m "data: rebuild scaling tables to include Adelheid (1055)"
```

---

### Task 9: Copy new portraits

**Files:**
- Create: `api/assets/game/faces/face_character_1055.png`, `face_character_30095.png` (plus any `portrait_character_*` variants used by the UI)
- Updated: `android-app/app/src/main/assets/faces/*.png`

- [ ] **Step 1: Find the source portraits in `output/`**

Run:
```powershell
Get-ChildItem "C:\Users\soste\Downloads\output\face" -Recurse -Filter "*1055*" | Select-Object FullName
Get-ChildItem "C:\Users\soste\Downloads\output\face" -Recurse -Filter "*30095*" | Select-Object FullName
```
Expected: at least `face_character_1055.png` and `face_character_30095.png` somewhere under `output/face/`.

- [ ] **Step 2: Copy into `api/assets/game/faces/`**

For each PNG found in Step 1 whose filename starts with `face_character_` or `portrait_character_`, copy to `api/assets/game/faces/`. Example:
```powershell
Copy-Item "C:\Users\soste\Downloads\output\face\character\face_character_1055.png" "C:\Users\soste\Documents\Vribbels-CZN-Optimizer\api\assets\game\faces\"
Copy-Item "C:\Users\soste\Downloads\output\face\character\face_character_30095.png" "C:\Users\soste\Documents\Vribbels-CZN-Optimizer\api\assets\game\faces\"
```
(Adjust paths to wherever Step 1 found the files.)

- [ ] **Step 3: Distribute to Android assets**

Run: `python scripts/copy_portraits.py`
Expected: stdout `Copied N portrait files to ...android-app/...assets/faces` with N greater than before.

- [ ] **Step 4: Commit**

```bash
git add api/assets/game/faces/face_character_1055.png api/assets/game/faces/face_character_30095.png android-app/app/src/main/assets/faces/
git commit -m "assets(portraits): add Adelheid (1055) and Clara (30095) portraits"
```

---

### Task 10: Regenerate Android character lookup

**Files:**
- Regenerated: `android-app/app/src/main/assets/characters.json`

- [ ] **Step 1: Run lookup export**

Run: `python scripts/extract_characters.py`
Expected: stdout `Written N characters to ...android-app/...assets/characters.json` with N now including Adelheid and Clara (count grew by 2).

- [ ] **Step 2: Verify both entries are present**

Run:
```powershell
python -c "import json; lk = json.loads(open('android-app/app/src/main/assets/characters.json', encoding='utf-8').read()); print(lk.get('Adelheid'), lk.get('Clara'))"
```
Expected: prints two dicts. Adelheid → `{'res_id': 1055, 'rarity': 4, 'kind': 'Combatant'}`. Clara → `{'res_id': 30095, 'rarity': 5, 'kind': 'Partner'}`.

- [ ] **Step 3: Commit**

```bash
git add android-app/app/src/main/assets/characters.json
git commit -m "android(assets): regenerate characters.json with Adelheid + Clara"
```

---

### Task 11: Validation

**Files:** (verification only)

- [ ] **Step 1: Run the test suite**

Run: `pytest tests/ -x 2>&1 | tail -40`
Expected: all tests pass. If a test that counts characters/partners fails (`assert len(CHARACTERS) == N`), bump the expected count by 1 in the test and re-run.

- [ ] **Step 2: Launch the API and confirm app shows Adelheid + Clara**

Start the optimizer's backend (e.g., `python -m api.main` or the bat used in dev). In the UI:
1. Open combatant picker → confirm Adelheid is listed and selectable.
2. Open partner picker → confirm Clara is listed.
3. Run an optimizer pass with Adelheid as the combatant → no crash, returns a build.

If the app cannot be launched in this environment, document in chat that backend-only validation passed (smoke imports + tests + bundle re-build) and recommend a manual visual check.

- [ ] **Step 3: Final commit (only if any cleanups needed)**

If steps above produced any incidental edits (count bumps in tests, etc.):
```bash
git add <changed files>
git commit -m "test: bump character/partner counts after adding Adelheid + Clara"
```

---

## Self-Review Notes

- **Spec coverage:** all four scope items selected by the user (cadastrar combatants, regenerate game_db, regenerate scaling, update portraits) are covered by Tasks 3+6, 7, 8, 9 respectively. Android lookup (Task 10) and validation (Task 11) wrap up.
- **Placeholders:** none — every step has code or exact commands.
- **Type consistency:** `extract()` / `_format_entry()` / `main()` signatures match across both scripts and across tests.
- **Risk-aware:** Task 6 explicitly calls out which fields require human curation rather than pretending the partner scaffold is a complete extraction.
