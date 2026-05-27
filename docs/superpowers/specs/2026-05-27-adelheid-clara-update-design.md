# Adelheid + Clara game update — design

**Date:** 2026-05-27
**Scope:** Register Adelheid (combatant, res_id 1055) and Clara (partner, res_id 30095) into the optimizer's data tier, regenerate all derived bundles, and introduce reusable auto-extraction scripts so future game updates take minutes instead of hours.

## Background

The game shipped an update. The unpacked client lives at `C:\Users\soste\Downloads\output\`. Two new entries are relevant:

- **Adelheid** — `char_base@name@1055` in `text/en/text.json`; full row in `db/char_base@char_combatant.json` under `id: "1055"`. Class `controller`, ego type `BLUE`, level group `c_lv_controller_sr` (grade 4 SR). Base stats: `s_atk=129, s_def=56, s_hp=74, s_cri=3, s_cri_dmg_rate=125`.
- **Clara** — `char_base@name@30095`; row in `db/partner_base@char_base.json` under `id: "30095"`.

Today, `api/game_data/characters.py::CHARACTERS` and `api/game_data/partners.py::PARTNERS` are hand-maintained dicts. Every game update repeats the same chore: open the new `.json` files, copy values, normalize text. We will write the extraction once and reuse forever.

## Goals

1. Adelheid appears in optimizer combatant pickers, scoring, simulator, and Android lookup.
2. Clara appears in partner picker with correct stats, scaled values per level, passive/ego text.
3. Re-running the data pipeline against the new `output/` produces a clean `game_db.json`, scaling tables, and portraits.
4. Future game updates: drop the new `output/` in place, run `extract_combatant.py` and `extract_partner.py` with the new res_ids, paste, rebuild.

## Non-goals

- No new combat mechanics, no balance changes to existing combatants.
- No optimizer scoring tweaks specific to Adelheid/Clara (use defaults).
- No deck-builder card UI work for the new characters in this spec (their cards land in `game_db.json` via `bundle_game_data.py`, which is enough for the optimizer; deck-builder manifest entries are a follow-up).

## Architecture

### New scripts

**`scripts/extract_combatant.py`**

```
python scripts/extract_combatant.py <output_dir> <res_id> [<res_id> ...]
```

Reads:
- `db/char_base@char_combatant.json` — base stats, class, ego type, level group
- `text/en/text.json` — name (`char_base@name@{id}`)
- `db/potential_node@potential_node_effect.json` — node_50/node_60 stat types

Resolves:
- `link_ego_type_id` (BLUE/RED/PURPLE/ORANGE/GREEN) → `attribute` via a mapping table inferred at script-build time from a known anchor (Yuki 1057 → Order; Hugo 1043 → Order; Rin 1018 → Void; Veronica 1033 → Passion; Magna 1010 → Justice; Khalipe 1008 → Instinct). The mapping is hard-coded inside the script after one-shot verification, not re-derived every run.
- `link_base_class_define_id` (controller/hunter/ranger/striker/vanguard/psionic) → `class` (capitalized).
- `link_combatant_level_group` suffix → `grade` (`_sr` → 4, `_ssr` → 5).
- `node_50` / `node_60`: from `potential_node@potential_node_effect.json`, filter rows whose `id` starts with `{res_id}50…` and `{res_id}60…`, extract the `stat_type` (HP%/ATK%/DEF%/CRate/CDmg).

Prints to stdout a Python dict literal ready to paste into `CHARACTERS`:

```python
    1055: {
        "name": "Adelheid",
        "grade": 4,
        "attribute": "Justice",
        "class": "Controller",
        "base_atk": 129,
        "base_def": 56,
        "base_hp": 74,
        "base_crit_rate": 3.0,
        "base_crit_dmg": 125.0,
        "base_weak_ego_dmg_rate": 125.0,
        "node_50": "...",
        "node_60": "...",
    },
```

Exits non-zero if any field cannot be resolved, so a silent miss never reaches `characters.py`.

**`scripts/extract_partner.py`**

```
python scripts/extract_partner.py <output_dir> <res_id> [<res_id> ...]
```

Reads:
- `db/partner_base@char_base.json` — base record, class, grade
- `db/partner_passive@partner_passive.json` — passive definition, link to skill effects
- `db/partner_passive@skill_eff.json` — value progression per level (1–5)
- `db/partner_passive@tooltip.json` — placeholder mapping for passive text
- `db/cs(partner)@cs.json` — EGO/CS card definition (name, cost)
- `db/cs(partner)@skill_eff.json` + `db/cs(partner)@tooltip.json` — EGO effect text
- `text/en/text.json` — names and localized strings

Resolves:
- `passive_desc` template — substitute concrete tooltip placeholders (`<cc>...</>` and similar) with the `{TokenName%}` form used today in `partners.py`. Token names taken from the tooltip's `value_key`/`stat_key`.
- `values` — per-level dict of tuples `{TokenName%: (v1, v2, v3, v4, v5)}` from skill_eff rows.
- `stats` — sub-dict containing only the stat-affecting tokens (`ATK%`, `DEF%`, `HP%`, `CRate%`, `CDmg%`).
- `ego_name`, `ego_cost`, `ego_desc` — from cs(partner) records.

Prints Python dict literal for `PARTNERS`.

### Mapping ground-truth check

Before trusting the BLUE/RED/etc → attribute map, the script asserts the mapping against three sentinels by running its own inference against res_ids 1057 (Yuki/Order), 1018 (Rin/Void), 1033 (Veronica/Passion). If any mismatch with the current `CHARACTERS` dict, abort with a clear error.

### Data pipeline (in order)

After running the two extractors and pasting their output into `characters.py` / `partners.py`:

1. `python scripts/bundle_game_data.py C:/Users/soste/Downloads/output` — regenerates `api/data/game_db.json` (now contains 1055 and 30095 in `char_base` plus their cards).
2. `python scripts/build_scaling_tables.py` — refreshes `api/data/char_base_l1.json` and `api/data/level_scaling.json`.
3. **Portraits**: copy `output/face/character/face_character_1055.png` and `face_character_30095.png` (plus `portrait_character_*` variants if present) into `api/assets/game/faces/`. Then `python scripts/copy_portraits.py` distributes them into `android-app/.../assets/faces/`.
4. `python scripts/extract_characters.py` — regenerates `android-app/app/src/main/assets/characters.json` from the updated dicts.
5. **Char presets** (combatant only): add an entry for Adelheid (1055) in `api/game_data/char_presets.py::_RAW`. The source is `db/piece_valid_setting@piece_valid_setting.json`; for now this is hand-translated. If `link_piece_valid_setting_id` in Adelheid's row is `"none"`, skip — she uses the default preset. (Note: Adelheid's row shows `link_piece_valid_setting_id: "none"`, so this step is a no-op for her.)

### Validation

- **Smoke imports:** `python -c "from api.game_data.characters import CHARACTERS; from api.game_data.partners import PARTNERS; print(CHARACTERS[1055]['name'], PARTNERS[30095]['name'])"` prints `Adelheid Clara`.
- **Reverse lookup:** `get_character_by_name("Adelheid")` returns a dict containing `base_weak_ego_dmg_rate`.
- **Pytest:** existing `tests/` suite remains green. Tests that iterate over CHARACTERS (count-based) get their expected count bumped by one; same for PARTNERS.
- **App smoke:** launch the optimizer (`python -m api.main` or via the Tauri shell), confirm Adelheid is selectable as a combatant and Clara as a partner. No crashes on a default scoring run.

### Future-update flow

1. Replace `C:\Users\soste\Downloads\output\` with a fresh client unpack.
2. Diff `output/text/en/text.json` for new `char_base@name@*` entries against current dicts to discover new res_ids.
3. Run `extract_combatant.py` and/or `extract_partner.py` with the new res_ids; paste output.
4. Rerun steps 1–4 of the pipeline above.

## Risks

- **Placeholder substitution heuristics** — the partner passive text uses `<cc>...</>` markup and tooltip references. If a new token shape appears, `extract_partner.py` may emit garbled `passive_desc`. Mitigation: script prints a warning when a tooltip placeholder cannot be resolved, and developer hand-edits before paste.
- **EGO `ego_desc` format** — existing entries use short two-line forms like `"250% Damage\nMark 1"`. Extraction may produce a more verbose form. Mitigation: developer reviews ego_desc on paste; auto-extract is best-effort here.
- **Attribute mapping anchor** — if a future game update changes the `link_ego_type_id` color scheme, the sentinel check inside `extract_combatant.py` will fail loudly rather than corrupt data.

## Files touched

New:
- `scripts/extract_combatant.py`
- `scripts/extract_partner.py`

Modified:
- `api/game_data/characters.py` — add 1055 entry
- `api/game_data/partners.py` — add 30095 entry
- `api/data/game_db.json` — regenerated by `bundle_game_data.py`
- `api/data/char_base_l1.json`, `api/data/level_scaling.json` — regenerated
- `android-app/app/src/main/assets/characters.json` — regenerated
- `api/assets/game/faces/face_character_1055.png` (and 30095) — copied from `output/face/character/`
- `android-app/app/src/main/assets/faces/*.png` — written by `copy_portraits.py`
- `api/game_data/char_presets.py` — no edit needed if Adelheid's `link_piece_valid_setting_id` is `"none"` (default preset)
