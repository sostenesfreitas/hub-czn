from __future__ import annotations

from pathlib import Path
import json
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api.state import state
import api.utils.text_lookup as text_lookup
import api.utils.game_db as game_db

router = APIRouter()

MORALE_PCT_PER_STACK = 20  # +20% card damage per Morale stack (cs00_0001_01 eff_value)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SimulateDamageRequest(BaseModel):
    char_name: str
    deck_id: int | None = None        # savedata id; None = pick highest-point deck
    morale: int = Field(default=0, ge=0, le=50)
    use_sparks: bool = True
    monster_def: int = Field(default=20, ge=0, le=9999)
    frightened: bool = False          # Weaken: player debuff ×0.75 damage dealt (cs00_0003)
    exposed_stacks: int = Field(default=0, ge=0, le=20)  # Vulnerable: +50% dmg taken per stack (cs00_0002)
    fortitude: bool = False           # Damage Reduction: monster buff ×0.85 dmg taken (cs00_0062)


class DeckInfo(BaseModel):
    deck_id: int
    name: str
    point: int
    card_count: int
    bookmark_slot: int


class CardResult(BaseModel):
    card_id: str
    name: str
    spark_id: str | None
    cost: int
    eff_value: int
    hits: int
    normal_damage: float
    crit_damage: float
    avg_damage: float
    icon_path: str | None


class SimulateDamageResponse(BaseModel):
    char_name: str
    deck_id: int
    atk: float
    crate: float
    cdmg: float
    morale_stacks: int
    morale_mult: float
    crit_factor: float
    monster_def: int
    def_reduction: float
    frightened: bool
    exposed_stacks: int
    fortitude: bool
    buff_mult: float
    cards: list[CardResult]
    total_normal: float
    total_crit: float
    total_avg: float


# ---------------------------------------------------------------------------
# Extracted-DB fallback helpers (for users who have the raw game files)
# ---------------------------------------------------------------------------

def _parse_list(raw: str) -> list[str]:
    raw = raw.strip()
    if raw in ("[]", "none", ""):
        return []
    return [x.strip() for x in raw.strip("[]").split(",") if x.strip()]


def _load_card_db_from_folder(db_path: Path) -> tuple[dict, dict, dict]:
    card_lookup: dict = {}
    eff_lookup: dict = {}
    rspark_lookup: dict = {}

    card_re = re.compile(r"card\([^)]+\)@card\.json$")
    eff_re = re.compile(r"card\([^)]+\)@skill_eff\.json$")
    rspark_re = re.compile(r"card\([^)]+\)@card_r_spark\.json$")

    for f in db_path.iterdir():
        if f.suffix != ".json":
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            if not isinstance(data, list):
                continue
        except Exception:
            continue

        name = f.name
        if card_re.match(name):
            for entry in data:
                cid = entry.get("id")
                if cid:
                    sct = entry.get("sct_name", "")
                    card_lookup[cid] = {
                        "cost": int(entry.get("cost", 0)),
                        "link_skill_eff_id": _parse_list(entry.get("link_skill_eff_id", "[]")),
                        "sct_name": sct if sct and sct != "none" else None,
                        "sort": entry.get("sort", ""),
                    }
        elif eff_re.match(name):
            for entry in data:
                eid = entry.get("id")
                if eid:
                    eff_lookup[eid] = {
                        "eff": entry.get("eff", ""),
                        "eff_value": int(float(entry.get("eff_value", 0))),
                        "eff_count_value": int(float(entry.get("eff_count_value", 1))),
                    }
        elif rspark_re.match(name):
            for entry in data:
                rid = entry.get("id")
                if rid:
                    rspark_lookup[rid] = entry.get("change_link_card_id", "")

    return card_lookup, eff_lookup, rspark_lookup


def _find_extracted_folder(name: str) -> Path | None:
    if not state.loaded_file:
        return None
    p = Path(state.loaded_file).parent
    for _ in range(3):
        candidate = p / name
        if candidate.exists():
            return candidate
        p = p.parent
    return None


def _resolve_card_db() -> tuple[dict, dict, dict]:
    """Return (card_lookup, eff_lookup, rspark_lookup) from bundled data or extracted db/."""
    bundled = game_db.get()
    if bundled.get("cards"):
        return bundled["cards"], bundled["effects"], bundled["rsparks"]
    db_path = _find_extracted_folder("db")
    if db_path:
        return _load_card_db_from_folder(db_path)
    return {}, {}, {}


def _load_node_effects_from_folder(db_path: Path) -> dict:
    p = db_path / "potential_node@potential_node_effect.json"
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}
    relevant = {
        "NODE_CARD_R_SPARK", "NODE_REINFORCE_CARD_START",
        "NODE_REINFORCE_CARD_NEUTRAL", "NODE_REINFORCE_CARD_UNIQUE",
        "NODE_STAT_ADD_SKILL_EFF_VALUE",
    }
    result: dict = {}
    for e in data:
        ntype = e.get("node_type", "")
        if ntype not in relevant:
            continue
        nid = e.get("id", "")
        if not nid:
            continue
        check_raw = e.get("check_link_stat_list_id", "none")
        result[nid] = {
            "type": ntype,
            "cards": _parse_list(e.get("link_card_id", "[]")),
            "val": int(float(e.get("value", 0))),
            "limit": int(e.get("stat_add_limit", 0)),
            "check": check_raw if check_raw != "none" else None,
            "thresh": int(e.get("stat_check_threshold", 0)),
            "excess": e.get("stat_check_use_excess", "FALSE") == "TRUE",
        }
    return result


def _resolve_node_effects() -> dict:
    bundled = game_db.get()
    if bundled.get("node_effects"):
        return bundled["node_effects"]
    db_path = _find_extracted_folder("db")
    if db_path:
        return _load_node_effects_from_folder(db_path)
    return {}


_REINFORCE_TO_SORTS: dict[str, frozenset] = {
    "NODE_REINFORCE_CARD_START":   frozenset({"SORT_START"}),
    "NODE_REINFORCE_CARD_NEUTRAL": frozenset({"SORT_COLLAPSE", "SORT_COLLAPSE_SKILL"}),
    "NODE_REINFORCE_CARD_UNIQUE":  frozenset({"SORT_UNIQUE"}),
}

_STAT_KEY_MAP: dict[str, str] = {
    "S_ATK": "ATK", "S_DEF": "DEF",
    "S_CRI": "CRate", "S_CRI_DMG_RATE": "CDmg",
}


def _decode_node_id(node_int: int) -> str:
    s = f"{node_int:08d}"
    return f"{s[:4]}_{s[4]}_{s[5]}_{int(s[6:8])}"


def _get_char_potential_nodes(res_id: int, raw_data: dict) -> list[int]:
    chars = raw_data.get("characters", {}).get("characters", [])
    for c in chars:
        if c.get("res_id") == res_id:
            nodes = c.get("potential_node_ids")
            if not nodes:
                return []
            if isinstance(nodes, str):
                try:
                    return json.loads(nodes)
                except Exception:
                    return []
            return list(nodes)
    return []


def _calc_stat_add_bonus(effect: dict, stats: dict) -> int:
    limit = effect["limit"]
    check = effect.get("check")
    thresh = effect.get("thresh", 0)
    excess = effect.get("excess", False)
    val = effect.get("val", 0)

    if not check:
        return limit

    stat_key = _STAT_KEY_MAP.get(check)
    if not stat_key:
        return 0
    stat_val = float(stats.get(stat_key, 0))

    if excess:
        usable = max(0.0, stat_val - thresh)
    else:
        if stat_val < thresh:
            return 0
        usable = stat_val

    if val <= 0:
        return limit
    return min(int(usable / val), limit)


def _compute_node_bonuses(
    node_ids: list[int], node_effects: dict, stats: dict
) -> tuple[dict[str, int], set[str], dict[str, int]]:
    """
    Returns:
        card_specific_bonus: {card_id -> per-execution eff_value bonus}
        pot_cards: base card IDs that should use the _pot variant
        sort_bonus: {sort_string -> per-execution eff_value bonus}
    """
    card_specific: dict[str, int] = {}
    pot_cards: set[str] = set()
    sort_bonus: dict[str, int] = {}

    for node_int in node_ids:
        node_key = _decode_node_id(node_int)
        effect = node_effects.get(node_key)
        if not effect:
            continue
        ntype = effect["type"]

        if ntype == "NODE_CARD_R_SPARK":
            for cid in effect["cards"]:
                pot_cards.add(cid)

        elif ntype in _REINFORCE_TO_SORTS:
            for sort in _REINFORCE_TO_SORTS[ntype]:
                sort_bonus[sort] = sort_bonus.get(sort, 0) + effect["val"]

        elif ntype == "NODE_STAT_ADD_SKILL_EFF_VALUE":
            bonus = _calc_stat_add_bonus(effect, stats)
            if bonus:
                for cid in effect["cards"]:
                    card_specific[cid] = card_specific.get(cid, 0) + bonus

    return card_specific, pot_cards, sort_bonus


def _get_card_name(card_id: str) -> str:
    bundled = game_db.get()
    if bundled.get("names"):
        return bundled["names"].get(f"card@name@{card_id}", "")
    text_base = _find_extracted_folder("text")
    if text_base:
        text_path = text_base / "en" / "text.json"
        if text_path.exists():
            text_lookup.load_from(text_path)
    return text_lookup.get(f"card@name@{card_id}", "")


def _card_damage(card_id: str, card_lookup: dict, eff_lookup: dict) -> tuple[int, int, int]:
    """Return (total_eff_value, total_hits, cost).

    total_eff_value = Σ(eff_value × hit_count) across all SKILL_EFF_DMG effects.
    This is the base card coefficient before per-execution node bonuses are added.
    Node bonuses (REINFORCE, STAT_ADD) apply per execution: bonus × total_hits is
    added by the caller to get the final coefficient.
    """
    entry = card_lookup.get(card_id)
    if not entry:
        return 0, 0, 0
    cost = entry["cost"]
    total_eff = 0
    total_hits = 0
    for eid in entry["link_skill_eff_id"]:
        eff = eff_lookup.get(eid)
        if eff and eff["eff"] == "SKILL_EFF_DMG":
            hits = eff["eff_count_value"]
            total_eff += eff["eff_value"] * hits
            total_hits += hits
    return total_eff, total_hits, cost


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/simulate/damage", response_model=SimulateDamageResponse)
def simulate_damage(body: SimulateDamageRequest):
    if not state.data_loaded:
        raise HTTPException(status_code=422, detail="No data loaded")
    if body.char_name not in state.optimizer.character_info:
        raise HTTPException(status_code=422, detail=f"Unknown character: {body.char_name}")

    # --- Character stats ---
    char_info = state.optimizer.character_info[body.char_name]
    equipped = state.optimizer.characters.get(body.char_name, [])
    stats = state.optimizer.calculate_build_stats(equipped, body.char_name)

    atk = stats.get("ATK", 0)
    crate = min(stats.get("CRate", 0), 100.0)
    cdmg = stats.get("CDmg", 125.0)

    # Expected damage factor: (crit% × crit_dmg%) + (non-crit% × 100%)
    crit_factor = (crate / 100) * (cdmg / 100) + (1 - crate / 100)
    morale_mult = 1 + (body.morale * MORALE_PCT_PER_STACK / 100)
    # DEF damage reduction: same formula used for EHP (def / 300)
    def_reduction = 300 / (300 + body.monster_def)
    # Combat status buff/debuff multipliers
    buff_mult = 1.0
    if body.frightened:
        buff_mult *= 0.75   # Weaken (cs00_0003): -25% damage dealt
    if body.exposed_stacks > 0:
        buff_mult *= 1 + body.exposed_stacks * 0.5  # Vulnerable (cs00_0002): +50% dmg taken per stack
    if body.fortitude:
        buff_mult *= 0.85   # Damage Reduction (cs00_0062): -15% dmg taken by monster

    # --- Load card DB (bundled first, extracted db/ as fallback) ---
    card_lookup, eff_lookup, rspark_lookup = _resolve_card_db()
    if not card_lookup:
        raise HTTPException(
            status_code=422,
            detail="Card data not available. Bundled game_db.json not found and no extracted db/ folder detected.",
        )

    # --- Load node effects and compute per-card bonuses ---
    node_effects = _resolve_node_effects()
    res_id = char_info.res_id
    char_node_ids = _get_char_potential_nodes(res_id, state.optimizer.raw_data)
    card_specific_bonus, pot_cards, sort_bonus = _compute_node_bonuses(
        char_node_ids, node_effects, stats
    )

    # --- Get character's card deck from save data ---
    savedata: list = state.optimizer.raw_data.get("inventory", {}).get("savedata", [])

    char_decks = [e for e in savedata if e.get("char_res_id") == res_id and e.get("card_datas")]
    if not char_decks:
        raise HTTPException(status_code=422, detail=f"No deck data found for {body.char_name} (res_id {res_id})")

    if body.deck_id is not None:
        deck_entry = next((e for e in char_decks if e.get("id") == body.deck_id), None)
        if deck_entry is None:
            raise HTTPException(status_code=422, detail=f"Deck {body.deck_id} not found for {body.char_name}")
    else:
        deck_entry = max(char_decks, key=lambda e: e.get("point", 0))

    card_datas = deck_entry.get("card_datas", [])

    # --- Simulate each card ---
    results: list[CardResult] = []
    for cd in card_datas:
        base_card_id: str = cd.get("res_id", "")
        if not base_card_id:
            continue

        rspark_id: str | None = cd.get("r_spark_res_id") if body.use_sparks else None

        # Apply NODE_CARD_R_SPARK (potential node pot transform) before rspark item
        effective_card_id = base_card_id
        if base_card_id in pot_cards:
            pot_id = base_card_id + "_pot"
            if card_lookup.get(pot_id):
                effective_card_id = pot_id

        # Apply r_spark item
        if rspark_id:
            changed = rspark_lookup.get(rspark_id, "")
            if changed:
                effective_card_id = changed

        eff_value, hits, cost = _card_damage(effective_card_id, card_lookup, eff_lookup)

        # Fallback to base card if spark/pot variant not found
        if eff_value == 0 and effective_card_id != base_card_id:
            eff_value, hits, cost = _card_damage(base_card_id, card_lookup, eff_lookup)
            effective_card_id = base_card_id
            rspark_id = None

        if eff_value == 0:
            continue  # non-damage card

        # Apply node bonuses (per execution, so multiply per-execution bonus by total hits)
        card_sort = card_lookup.get(effective_card_id, {}).get("sort", "")
        per_exec_bonus = sort_bonus.get(card_sort, 0) + card_specific_bonus.get(effective_card_id, 0)
        if per_exec_bonus and hits:
            eff_value += per_exec_bonus * hits

        card_name = _get_card_name(effective_card_id) or _get_card_name(base_card_id)
        # spark variant may lack sct_name; fall back to base card illustration
        sct_name = (
            card_lookup.get(effective_card_id, {}).get("sct_name")
            or card_lookup.get(base_card_id, {}).get("sct_name")
        )
        icon_path = f"/assets/cards/{sct_name}.webp" if sct_name else None

        # dmg_revise_rate=0.36 from constant_meta(stat_formula): this is the default lookup key
        # into the powerstep_define table, which stores per-power-step monster stat multipliers
        # (dmg_revise, hp_revise, cure_revise, shield_revise). The table scales MONSTER stats
        # by difficulty tier — it is NOT a multiplier on player card damage output. Excluded.
        #
        # The two other stat_formula constants (dmg_decrease_rate_0_value=-160,
        # dmg_decrease_rate_curv_value=300) are parameters of the DEF reduction curve, which
        # is already applied below as: def_reduction = 300 / (300 + monster_def). Confirmed.
        base_dmg = atk * (eff_value / 100)
        normal_dmg = base_dmg * morale_mult * buff_mult * def_reduction
        crit_dmg = base_dmg * (cdmg / 100) * morale_mult * buff_mult * def_reduction
        # avg uses pre-rounded intermediates; stored normal/crit are rounded separately
        avg_dmg = normal_dmg * (1 - crate / 100) + crit_dmg * (crate / 100)

        results.append(CardResult(
            card_id=base_card_id,
            name=card_name,
            spark_id=rspark_id,
            cost=cost,
            eff_value=eff_value,
            hits=hits,
            normal_damage=round(normal_dmg, 1),
            crit_damage=round(crit_dmg, 1),
            avg_damage=round(avg_dmg, 1),
            icon_path=icon_path,
        ))

    total_normal = sum(r.normal_damage for r in results)
    total_crit = sum(r.crit_damage for r in results)
    total_avg = sum(r.avg_damage for r in results)

    return SimulateDamageResponse(
        char_name=body.char_name,
        deck_id=deck_entry["id"],
        atk=round(atk, 1),
        crate=round(crate, 1),
        cdmg=round(cdmg, 1),
        morale_stacks=body.morale,
        morale_mult=round(morale_mult, 3),
        crit_factor=round(crit_factor, 3),
        monster_def=body.monster_def,
        def_reduction=round(def_reduction, 4),
        frightened=body.frightened,
        exposed_stacks=body.exposed_stacks,
        fortitude=body.fortitude,
        buff_mult=round(buff_mult, 4),
        cards=results,
        total_normal=round(total_normal, 1),
        total_crit=round(total_crit, 1),
        total_avg=round(total_avg, 1),
    )


@router.get("/simulate/decks/{char_name}", response_model=list[DeckInfo])
def get_character_decks(char_name: str):
    if not state.data_loaded:
        raise HTTPException(status_code=422, detail="No data loaded")
    if char_name not in state.optimizer.character_info:
        raise HTTPException(status_code=422, detail=f"Unknown character: {char_name}")

    char_info = state.optimizer.character_info[char_name]
    savedata: list = state.optimizer.raw_data.get("inventory", {}).get("savedata", [])
    char_decks = [e for e in savedata if e.get("char_res_id") == char_info.res_id and e.get("card_datas")]

    result = [
        DeckInfo(
            deck_id=e["id"],
            name=e.get("name") or "",
            point=e.get("point", 0),
            card_count=len(e.get("card_datas", [])),
            bookmark_slot=e.get("bookmark_slot", 0),
        )
        for e in char_decks
    ]
    result.sort(key=lambda d: (-d.bookmark_slot, -d.point))
    return result
