# Adelheid + Clara game update — design

**Date:** 2026-05-27
**Scope:** Register Adelheid (combatant, res_id 1055) and Clara (partner, res_id 30095) into the optimizer's data tier, regenerate all derived bundles, and introduce reusable auto-extraction scripts so future game updates take minutes instead of hours.

## Background

The game shipped an update. The unpacked client lives at `C:\Users\soste\Downloads\output\`. Two new entries are relevant:

- **Adelheid** — `char_base@name@1055` in `text/en/text.json`. Display attributes from `db/char_base@char_base.json`: `rarity: "RARITY_SSR"` (grade 5), `link_char_growth_material_id: "c_knight_purple"` (Vanguard / Void). Stats from `db/char_base@char_combatant.json`: `s_atk=129, s_def=56, s_hp=74, s_cri=3, s_cri_dmg_rate=125, link_combatant_level_group=c_lv_controller_sr`. **Note:** the stats and level group in `char_combatant.json` are placeholder Controller-SR values (identical to Nia 1003). The user's in-game Lv60 stats show ATK=327, DEF=153, HP=403 — which match neither Controller SR (Nia: 392/186/313) nor Vanguard SSR (Khalipe: 407/183/423), confirming the DB is internally inconsistent for this combatant. We manually override `base_atk/base_def/base_hp` in `CHARACTERS[1055]` with the user-observed Lv60 values; once Adelheid's `char_combatant.json` row is corrected by the devs and the extracted client is refreshed, `extract_combatant.py` will produce correct numbers automatically.
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
- `db/char_base@char_base.json` — display class, attribute, grade (rarity)
- `db/char_base@char_combatant.json` — base stats (`s_atk` etc.)
- `text/en/text.json` — name (`char_base@name@{id}`)
- `db/potential_node@potential_node_effect.json` — node_50/node_60 stat types

Resolves:
- `link_char_growth_material_id` (from `char_base@char_base.json`) of the shape `c_{class_key}_{color_key}` → `class` and `attribute`:
  - class_key: `controller`→Controller, `knight`→Vanguard, `striker`→Striker, `ranger`→Ranger, `hunter`→Hunter, `psionic`→Psionic
  - color_key: `orange`→Instinct, `blue`→Justice, `purple`→Void, `red`→Passion, `green`→Order
- `rarity` (from `char_base@char_base.json`): `RARITY_SSR`→5, `RARITY_SR`→4, `RARITY_R`→3.
- Base stats from `char_base@char_combatant.json` row keys `s_atk/s_def/s_hp/s_cri/s_cri_dmg_rate/s_weak_ego_dmg_rate`.
- `node_50` / `node_60`: from `potential_node@potential_node_effect.json`, filter rows whose `id` starts with `{res_id}50…` and `{res_id}60…`, extract the `stat_type` (HP%/ATK%/DEF%/CRate/CDmg).

The historical `link_ego_type_id` and `link_base_class_define_id` fields in `char_combatant.json` are **ignored** — they reflect mechanics/card-pool internals, not display, and disagree with `char_base@char_base.json` for at least one live combatant (Adelheid).

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

Before trusting the `c_{class}_{color}` map, tests run the extractor against six well-known combatants and compare against the existing `CHARACTERS` dict:
- 1003 Nia → Controller / Instinct (c_controller_orange)
- 1008 Khalipe → Vanguard / Instinct (c_knight_orange)
- 1010 Magna → Vanguard / Justice (c_knight_blue)
- 1018 Rin → Striker / Void (c_striker_purple)
- 1033 Veronica → Ranger / Passion (c_ranger_red)
- 1057 Yuki → Striker / Order (c_striker_green)

If any anchor fails, the script's mapping table is wrong and the test surfaces it loudly.

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
