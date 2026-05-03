from __future__ import annotations

from pathlib import Path
import json
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api.state import state

router = APIRouter()

MORALE_PCT_PER_STACK = 20  # +20% card damage per Morale stack (cs00_0001_01 eff_value)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SimulateDamageRequest(BaseModel):
    char_name: str
    morale: int = Field(default=0, ge=0, le=50)
    use_sparks: bool = True
    monster_def: int = Field(default=20, ge=0, le=9999)
    frightened: bool = False          # player debuff: ×0.75 damage dealt (cs00_0003)
    exposed_stacks: int = Field(default=0, ge=0, le=20)  # monster debuff: +50% dmg taken per stack (cs00_0002)
    fortitude: bool = False           # monster buff: ×0.85 dmg taken (cs00_0062)


class CardResult(BaseModel):
    card_id: str
    spark_id: str | None
    cost: int
    eff_value: int
    hits: int
    base_damage: float
    avg_damage: float
    final_damage: float
    effective_damage: float


class SimulateDamageResponse(BaseModel):
    char_name: str
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
    total_damage: float
    total_effective_damage: float


# ---------------------------------------------------------------------------
# Card DB loading helpers
# ---------------------------------------------------------------------------

def _parse_list(raw: str) -> list[str]:
    """Parse a game DB array string like '[a,b,c]' into a Python list."""
    raw = raw.strip()
    if raw in ("[]", "none", ""):
        return []
    return [x.strip() for x in raw.strip("[]").split(",") if x.strip()]


def _load_card_db(db_path: Path) -> tuple[dict, dict, dict]:
    """
    Load all card(*) and r_spark files from the db folder.

    Returns:
        card_lookup:   {card_id: {cost, link_skill_eff_id, ...}}
        eff_lookup:    {eff_id: {eff, eff_value, eff_count_value}}
        rspark_lookup: {rspark_id: change_link_card_id}
    """
    card_lookup: dict = {}
    eff_lookup: dict = {}
    rspark_lookup: dict = {}

    card_re = re.compile(r"card\([^)]+\)@card\.json$")
    eff_re = re.compile(r"card\([^)]+\)@skill_eff\.json$")
    rspark_re = re.compile(r"card\([^)]+\)@card_r_spark\.json$")

    for f in db_path.iterdir():
        if not f.suffix == ".json":
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
                    card_lookup[cid] = {
                        "cost": int(entry.get("cost", 0)),
                        "link_skill_eff_id": _parse_list(entry.get("link_skill_eff_id", "[]")),
                    }
        elif eff_re.match(name):
            for entry in data:
                eid = entry.get("id")
                if eid:
                    eff_lookup[eid] = {
                        "eff": entry.get("eff", ""),
                        "eff_value": int(entry.get("eff_value", 0)),
                        "eff_count_value": int(entry.get("eff_count_value", 1)),
                    }
        elif rspark_re.match(name):
            for entry in data:
                rid = entry.get("id")
                if rid:
                    rspark_lookup[rid] = entry.get("change_link_card_id", "")

    return card_lookup, eff_lookup, rspark_lookup


def _get_db_path() -> Path | None:
    if state.loaded_file:
        candidate = Path(state.loaded_file).parent / "db"
        if candidate.exists():
            return candidate
    return None


def _card_damage(card_id: str, card_lookup: dict, eff_lookup: dict) -> tuple[int, int, int]:
    """Return (total_eff_value, total_hits, cost) for a card; eff_value is summed across all DMG effects."""
    entry = card_lookup.get(card_id)
    if not entry:
        return 0, 0, 0
    cost = entry["cost"]
    total_eff = 0
    total_hits = 0
    for eid in entry["link_skill_eff_id"]:
        eff = eff_lookup.get(eid)
        if eff and eff["eff"] == "SKILL_EFF_DMG":
            total_eff += eff["eff_value"]
            total_hits += eff["eff_count_value"]
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

    db_path = _get_db_path()
    if db_path is None:
        raise HTTPException(
            status_code=422,
            detail="Game DB folder not found. Expected a 'db/' subfolder next to the loaded capture file.",
        )

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
        buff_mult *= 0.75   # cs00_0003: MATHSIGN_MULTIPLY_PCT 75
    if body.exposed_stacks > 0:
        buff_mult *= 1 + body.exposed_stacks * 0.5  # cs00_0002: MATHSIGN_ADD_HUND_MULTIPLY_PCT 50
    if body.fortitude:
        buff_mult *= 0.85   # cs00_0062: MATHSIGN_MULTIPLY_PCT 85

    # --- Load card DB ---
    card_lookup, eff_lookup, rspark_lookup = _load_card_db(db_path)

    # --- Get character's card deck from save data ---
    raw_chars = state.optimizer.raw_data.get("characters", {})
    slot_entities = raw_chars.get("savedata_slot_entities", [])

    res_id = char_info.res_id
    deck_entry = next(
        (e for e in slot_entities if e.get("char_res_id") == res_id),
        None,
    )

    if not deck_entry:
        raise HTTPException(status_code=422, detail=f"No deck data found for {body.char_name} (res_id {res_id})")

    card_datas = deck_entry.get("card_datas", [])

    # --- Simulate each card ---
    results: list[CardResult] = []
    for cd in card_datas:
        base_card_id: str = cd.get("res_id", "")
        if not base_card_id:
            continue

        rspark_id: str | None = cd.get("r_spark_res_id") if body.use_sparks else None
        effective_card_id = base_card_id

        if rspark_id:
            changed = rspark_lookup.get(rspark_id, "")
            if changed:
                effective_card_id = changed

        eff_value, hits, cost = _card_damage(effective_card_id, card_lookup, eff_lookup)

        # Fallback to base card if spark variant not found
        if eff_value == 0 and effective_card_id != base_card_id:
            eff_value, hits, cost = _card_damage(base_card_id, card_lookup, eff_lookup)
            effective_card_id = base_card_id
            rspark_id = None

        if eff_value == 0:
            continue  # non-damage card

        base_dmg = atk * (eff_value / 100)
        avg_dmg = base_dmg * crit_factor
        final_dmg = avg_dmg * morale_mult * buff_mult
        effective_dmg = final_dmg * def_reduction

        results.append(CardResult(
            card_id=base_card_id,
            spark_id=rspark_id,
            cost=cost,
            eff_value=eff_value,
            hits=hits,
            base_damage=round(base_dmg, 1),
            avg_damage=round(avg_dmg, 1),
            final_damage=round(final_dmg, 1),
            effective_damage=round(effective_dmg, 1),
        ))

    total_dmg = sum(r.final_damage for r in results)
    total_eff_dmg = sum(r.effective_damage for r in results)

    return SimulateDamageResponse(
        char_name=body.char_name,
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
        total_damage=round(total_dmg, 1),
        total_effective_damage=round(total_eff_dmg, 1),
    )


@router.get("/simulate/deck/{char_name}")
def get_deck(char_name: str):
    """Return the raw card deck for a character (for debugging)."""
    if not state.data_loaded:
        raise HTTPException(status_code=422, detail="No data loaded")
    if char_name not in state.optimizer.character_info:
        raise HTTPException(status_code=422, detail=f"Unknown character: {char_name}")

    char_info = state.optimizer.character_info[char_name]
    raw_chars = state.optimizer.raw_data.get("characters", {})
    slot_entities = raw_chars.get("savedata_slot_entities", [])

    deck_entry = next(
        (e for e in slot_entities if e.get("char_res_id") == char_info.res_id),
        None,
    )
    return {"res_id": char_info.res_id, "deck": deck_entry}
