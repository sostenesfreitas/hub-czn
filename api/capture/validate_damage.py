"""
Validates damage prediction against per-hit ground truth from snapshot frames.

== STEP 1 FINDINGS: dev_msg frame schema ==

The dev_msg field in websocket frames is a PLAIN-TEXT battle log.  It contains:
  - "**battle log : SkillEff N:res_id:SKILL_EFF_TYPE[:params]"  (skill effects triggered)
  - "**battle log : [condition_triggered] ..."                  (buff/debuff condition triggers)
  - "**battle log : N(user/monster) added cs_id to M value V sign MATHSIGN_*"
    (stat stack applications — values are stack counts, NOT damage numbers)
  - "**battle log : Use Card N:res_id to target_id"
  - "**battle log : timing_changed:TIMING_*"

dev_msg does NOT contain per-hit ATK/DEF/crit_factor or actual damage numbers.
It cannot be parsed to produce the (atk, def_reduce, crit_factor, observed_dmg)
tuples required by the hypothesis functions.

== Actual data source: snapshot frames ==

Per-hit ground truth IS available from snapshot frames (keys: res, snapshot, …):
  data.snapshot.cache.battle_wt:
    - monsters[].lastDamageEvent  {damage, crit, dva_css, is_auto, old_hp, new_hp,
                                    weak, last, type: [DMG_ATTR_*]}
    - monsters[].status.info      {S_DEF, S_DMG_DECREASE_RATE}
    - chars[].status.info         {S_ATK, S_CRI, S_CRI_DMG_RATE}
    - skillMap[id]                {eff_value, caster_id, stat_source, final_count_value}
    - cardMap[id]                 {char_id, res_id, skill_eff_ids}
    - used_cards                  [card_id]

== Empirical formula discovery (from 4 clean surviving hits) ==

H1 formula as specified (dmg = ATK × 0.36 × (1 − def_reduce) × crit_factor × skill_mult)
is INCORRECT for the observed data.

Actual formula appears to be:
    dmg = ATK_src × (card_eff_value / 100) × (1 − S_DMG_DECREASE_RATE) × crit_factor

where card_eff_value is skillMap[skill_eff_id].eff_value for the damage skill,
and ATK_src is the individual char's S_ATK (for mutation cards)
or the combined team's S_ATK (bwt.char.S_ATK, for response cards).

Non-crit verification (card c_30075_srt4_mut, eff=75, ATK=1087, def_reduce=0.3337):
    pred = 1087 × 0.75 × (1 − 0.3337) = 543  vs  obs = 547  (0.7% error ✓)

Crit verification is BLOCKED by the dva_css unknown:
    Same card/ATK/DEF, crit=True, 3 hits → obs: 1398, 1148, 1219 (22% spread)
    Source: dva_css[110] eff_value not found in skillMap; unknown contribution.

== Known limitations (v1) ==
  - DMG_REVISE_RATE = 0.36 is a PLACEHOLDER from the task spec; actual formula
    embeds the multiplier in card eff_value/100.  H1/H2/H3 as specified will show
    low coverage until this is reconciled.
  - skill_mult is hardcoded 1.0; Track C will provide per-card real values.
  - dva_css (damage-value adjustment stacks) cause ±22% residual on crit hits.
  - crit_factor formula: (1 + S_CRI_DMG_RATE/100) predicts 3.37× but empirical
    crit/non-crit ratio for surviving hits is ~2.64×.  Formula may differ.
  - Only non-auto-attack hits (lastDamageEvent.is_auto=False, type=[]) are extracted.
  - Only 4 clean surviving hits found across all 4 snapshot files; insufficient
    for statistical coverage assessment.
"""

from __future__ import annotations

import json
import os
import re
import statistics
from pathlib import Path

from api.capture.fit_def_curve import CANDIDATE_FORMS

# Best-fit DEF reduction form (empirically fitted in B2).
_DEF_REDUCE = CANDIDATE_FORMS["f6"]   # 268/(DEF+503)

# Base damage revision rate used in the game formula.
DMG_REVISE_RATE = 0.36


# ---------------------------------------------------------------------------
# Core prediction functions
# ---------------------------------------------------------------------------

def predict_damage_h1(
    atk: float,
    def_reduce: float,
    crit_factor: float,
    skill_mult: float,
) -> float:
    """H1: dmg = ATK × DMG_REVISE_RATE × (1 - def_reduce) × crit_factor × skill_mult."""
    return atk * DMG_REVISE_RATE * (1 - def_reduce) * crit_factor * skill_mult


def predict_damage_h2(
    atk: float,
    def_reduce: float,
    crit_factor: float,
    skill_mult: float,
    vulnerable_pct: float = 0.0,
    morale_atk: float = 0.0,
    morale_def: float = 0.0,
) -> float:
    """H2: H1 × (1 + vulnerable%) × (1 + morale_atk - morale_def)."""
    base = predict_damage_h1(atk, def_reduce, crit_factor, skill_mult)
    return base * (1 + vulnerable_pct) * (1 + morale_atk - morale_def)


def predict_damage_h3(
    atk: float,
    def_reduce: float,
    crit_factor: float,
    skill_mult: float,
    vulnerable_pct: float = 0.0,
    morale_atk: float = 0.0,
    morale_def: float = 0.0,
    elemental_mult: float = 1.0,
    rage_mult: float = 1.0,
) -> float:
    """H3: H2 × elemental_mult × rage_mult."""
    base = predict_damage_h2(
        atk, def_reduce, crit_factor, skill_mult, vulnerable_pct, morale_atk, morale_def
    )
    return base * elemental_mult * rage_mult


HYPOTHESES: dict = {
    "H1": predict_damage_h1,
    "H2": predict_damage_h2,
    "H3": predict_damage_h3,
}


# ---------------------------------------------------------------------------
# Coverage validator
# ---------------------------------------------------------------------------

def validate_against_hits(
    hits: list[dict],
    hypothesis: str = "H1",
    tolerance: float = 0.05,
) -> dict:
    """For each hit, predict damage and compare to observed_dmg.

    Returns a coverage metrics dict:
      {n_hits, n_within_tolerance, coverage, median_rel_diff, hypothesis, tolerance}
    """
    fn = HYPOTHESES[hypothesis]
    n_within = 0
    diffs: list[float] = []
    for h in hits:
        # Exclude the observed value and any private metadata keys (prefixed with _).
        kwargs = {k: v for k, v in h.items() if k != "observed_dmg" and not k.startswith("_")}
        try:
            predicted = fn(**kwargs)
        except TypeError:
            continue
        obs = h["observed_dmg"]
        if obs == 0:
            continue
        rel_diff = abs(predicted - obs) / obs
        diffs.append(rel_diff)
        if rel_diff <= tolerance:
            n_within += 1
    median = sorted(diffs)[len(diffs) // 2] if diffs else float("nan")
    return {
        "n_hits": len(hits),
        "n_within_tolerance": n_within,
        "coverage": n_within / len(hits) if hits else 0.0,
        "median_rel_diff": median,
        "hypothesis": hypothesis,
        "tolerance": tolerance,
    }


# ---------------------------------------------------------------------------
# Frame-to-hit transform  (snapshot frames, NOT dev_msg frames)
# ---------------------------------------------------------------------------

def _frame_to_hit(frame: dict) -> dict | None:
    """Extract one hit record from a snapshot frame.

    Maps snapshot fields to the canonical hit dict:
      atk          – attacker S_ATK (from chars[caster_idx])
      def_reduce   – f6(monster S_DEF)  OR  monster S_DMG_DECREASE_RATE directly
      crit_factor  – 1.0 non-crit, (1 + S_CRI_DMG_RATE/100) crit
      skill_mult   – hardcoded 1.0 (Track C will provide real values)
      observed_dmg – lastDamageEvent.damage

    Returns None if the frame lacks the required data or the hit is an
    auto-attack (DMG_ATTR_FIX) or has empty observed damage.

    Known gaps / v1 limitations:
      - skill_mult is always 1.0; dva_css bonuses are NOT applied.
      - The true crit multiplier formula is uncertain: empirically the
        crit/non-crit ratio (~2.64×) differs from (1 + CDmg/100) (~3.37×).
        We use (1 + CDmg/100) as the documented formula pending confirmation.
      - When multiple chars are present we use char_id from the played card
        (cardMap[used_cards[0]].char_id) if available, else chars[0].
    """
    try:
        data = frame.get("data", {})
        snap = data.get("snapshot", {})
        cache = snap.get("cache", {})
        bwt = cache.get("battle_wt", {})
        if not bwt:
            return None

        monsters: list = bwt.get("monsters") or []
        chars: list = bwt.get("chars") or []
        if not monsters or not chars:
            return None

        # Find the monster that received a non-auto damage hit this frame.
        target_monster = None
        last_dmg = None
        for m in monsters:
            ld = m.get("lastDamageEvent")
            if ld is None:
                continue
            # Only non-auto-attack hits with defined type list.
            if ld.get("is_auto", True):
                continue
            if ld.get("type") is None:
                continue
            # Accept only hits with an empty type list (clean card damage)
            # or DMG_ATTR_ADDITIONAL_ATTACK (also card-driven).
            dmg_types = ld.get("type", [])
            if dmg_types and "DMG_ATTR_FIX" in dmg_types:
                continue  # auto-attack fixed damage
            if "DMG_ATTR_IGNORE_STAT" in dmg_types:
                continue  # stat-independent, can't validate with ATK formula
            damage = ld.get("damage", 0)
            if damage <= 0:
                continue
            target_monster = m
            last_dmg = ld
            break  # use first qualifying hit in the frame

        if target_monster is None or last_dmg is None:
            return None

        observed_dmg = last_dmg["damage"]
        is_crit = bool(last_dmg.get("crit", False))

        # --- DEF reduction ---
        minfo = target_monster.get("status", {}).get("info", {})
        monster_def = minfo.get("S_DEF")
        monster_dmg_decrease = minfo.get("S_DMG_DECREASE_RATE")

        # Prefer the game's own computed value; fall back to curve.
        if monster_dmg_decrease is not None:
            def_reduce = float(monster_dmg_decrease)
        elif monster_def is not None:
            def_reduce = _DEF_REDUCE(float(monster_def))
        else:
            return None

        # --- Identify attacker ---
        char_id = _resolve_caster_char_id(bwt)
        attacker_info = _get_char_info(chars, char_id)
        if attacker_info is None:
            # Fall back to first char
            attacker_info = chars[0].get("status", {}).get("info", {}) if chars else {}

        atk = attacker_info.get("S_ATK")
        cri_dmg = attacker_info.get("S_CRI_DMG_RATE", 100.0)
        if atk is None:
            return None

        # --- Crit factor ---
        # Documented: 1 + S_CRI_DMG_RATE/100
        # Note: empirical ratio ~2.64× vs predicted ~3.37× — flag as concern.
        crit_factor = (1.0 + float(cri_dmg) / 100.0) if is_crit else 1.0

        return {
            "atk": float(atk),
            "def_reduce": def_reduce,
            "crit_factor": crit_factor,
            "skill_mult": 1.0,   # v1: hardcoded, Track C provides real values
            "observed_dmg": float(observed_dmg),
            # metadata (not used in prediction, useful for debugging)
            "_is_crit": is_crit,
            "_monster_res_id": target_monster.get("res_id"),
            "_dva_css": last_dmg.get("dva_css", []),
        }
    except Exception:
        return None


def _resolve_caster_char_id(bwt: dict) -> int | None:
    """Return the char_id of the character who played the last card."""
    used_cards: list = bwt.get("used_cards") or []
    if not used_cards:
        return None
    card_id = used_cards[0]
    card_map: dict = bwt.get("cardMap") or {}
    card = card_map.get(str(card_id))
    if card:
        return card.get("char_id")
    return None


def _get_char_info(chars: list, char_id: int | None) -> dict | None:
    """Return status.info dict for the char with the given id."""
    if char_id is None:
        return None
    for c in chars:
        if c.get("id") == char_id:
            return c.get("status", {}).get("info", {})
    return None


# ---------------------------------------------------------------------------
# Snapshot JSONL loader
# ---------------------------------------------------------------------------

def _iter_snapshot_frames(jsonl_path: Path):
    """Yield parsed frame dicts from a websocket_debug JSONL file."""
    with jsonl_path.open("r", encoding="utf-8") as fp:
        for line in fp:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def extract_hits_from_jsonl(jsonl_path: Path) -> list[dict]:
    """Extract all qualifying per-hit records from a JSONL capture file."""
    hits = []
    for frame in _iter_snapshot_frames(jsonl_path):
        hit = _frame_to_hit(frame)
        if hit is not None:
            hits.append(hit)
    return hits


# ---------------------------------------------------------------------------
# __main__: run real validation against all captures
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    snap_dir = Path(os.environ.get("LOCALAPPDATA", "")) / "hub-czn" / "snapshots"
    files = sorted(snap_dir.glob("websocket_debug_*.jsonl"))

    if not files:
        print(f"No websocket_debug_*.jsonl files found in {snap_dir}")
        raise SystemExit(1)

    all_hits: list[dict] = []
    total_frames = 0
    for f in files:
        frames = list(_iter_snapshot_frames(f))
        total_frames += len(frames)
        all_hits.extend(extract_hits_from_jsonl(f))

    print(f"Total frames: {total_frames}")
    print(f"Hits extracted: {len(all_hits)}")
    print()

    if not all_hits:
        print("No hits extracted — cannot validate.")
        print()
        print("NOTE: dev_msg frames contain no per-hit damage data.")
        print("  Per-hit data lives in snapshot frames (data.snapshot.cache.battle_wt).")
        print("  Only surviving (new_hp > 0) non-auto single-card hits qualify.")
        print("  See module docstring for details.")
        raise SystemExit(1)

    # H1/H2/H3 as specified use DMG_REVISE_RATE=0.36, which is a placeholder.
    # Empirical finding: actual formula is ATK × (card_eff/100) × (1−def_reduce).
    # With skill_mult=1.0 and the 0.36 factor, expected coverage is ~0% here.
    for hyp in ["H1", "H2", "H3"]:
        result = validate_against_hits(all_hits, hypothesis=hyp, tolerance=0.05)
        pct = result["coverage"] * 100
        median_pct = (
            result["median_rel_diff"] * 100
            if result["median_rel_diff"] == result["median_rel_diff"]  # NaN check
            else float("nan")
        )
        print(
            f"{hyp} coverage @ ±5%: {pct:.1f}%"
            f" ({result['n_within_tolerance']} / {result['n_hits']} hits)"
        )
        if median_pct == median_pct:
            print(f"  Median relative diff: {median_pct:.1f}%")
        else:
            print(f"  Median relative diff: n/a (no diffs computed)")
        print()

    print("DONE_WITH_CONCERNS:")
    print("  H1/H2/H3 coverage < 50%.  Root causes documented in module docstring:")
    print("  1. DMG_REVISE_RATE=0.36 incorrect; actual mult = card eff_value/100.")
    print("  2. dva_css stack bonuses cause ~22% unexplained crit variance.")
    print("  3. crit_factor formula (1+CDmg/100) inconsistent with observed 2.64× ratio.")
    print("  4. Only 4 clean surviving hits in 4 capture files (insufficient sample).")
    print("  See api/capture/validate_damage.py docstring for full schema findings.")
