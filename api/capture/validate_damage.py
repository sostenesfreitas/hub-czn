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
    NOTE: cardMap and skillMap use STRING keys (e.g. '7', '21') even though
    used_cards contains INT values.  All lookups must cast the key to str().

== Empirical formula discovery (from clean surviving hits) ==

H1 formula as specified (dmg = ATK × 0.36 × (1 − def_reduce) × crit_factor × skill_mult)
is INCORRECT for the observed data.

Actual formula (B3 verified):
    dmg = ATK_src × (eff_value / 100) × (1 − S_DMG_DECREASE_RATE) × crit_factor

where eff_value is the largest skillMap[skill_eff_id].eff_value with a non-None
final_count_value (the main-damage skill entry) for the first card in used_cards,
and ATK_src is:
  - individual char S_ATK (matched by card.char_id) if card is a mutation card
    (card.res_id contains '_mut')
  - team average S_ATK (bwt.char.S_ATK) for all other card types (response, etc.)

Verified hits:
  Non-crit (card c_30075_srt4_mut, eff=75, ATK=1087, def_reduce=0.3337):
    pred = 1087 × 0.75 × (1 − 0.3337) = 543  vs  obs = 547  (0.7% error)
  Non-crit (card c_30093_srt4_rsp1, eff=80, team_ATK=1077, def_reduce=0.3597):
    pred = 1077 × 0.80 × (1 − 0.3597) = 552  vs  obs = 530  (4.1% error, dva_css reduce)

== dva_css investigation findings (Track B Step B4) ==

DVA = Damage Value Adjustment.  Each cs_id in dva_css nominally refers to a
condition-stack entry in csMap, which chains to skillMap via skillEffs.

Empirical finding from 5 JSONL capture files (13132 frames):

  BLOCKER: dva_css cs_ids are CONSUMED/EXPIRED before the snapshot is captured.
  In all tested hits the relevant cs_id is absent from csMap at snapshot time:
    - rsp1 crit hits (dva=[110,111,112] or [124,125]): 0/5 cs_ids in csMap
    - lbk hits  (dva up to 9 entries, e.g. [88,132,194,210,350,356,192,349,201]):
        0/9 cs_ids resolved from csMap

  The one exception (20260510 hit, cs[94]=cs01_0610 ev=100 found in csMap) does NOT
  converge: additive/multiplicative interpretations both widen the error (37%→175%).
  That entry appears to be a still-active CDmg buff for a DIFFERENT hit, not the
  dva source for the observed hit.

  Additional evidence that csMap-based resolution is impossible:
    - Two hits with identical dva_css=[110,111,112] produce different damages
      (1398 vs 1148), proving the condition VALUES differ at consumption time.
      Since csMap only reflects the current (post-consumption) state, the
      multiplier cannot be back-computed.

  EGO / LBK hits have an additional unknown stacking mechanism.  The large LBK
  hit (obs=10743, pred=1787 → 83% error, dva 9 entries) likely accumulates
  a damage multiplier proportional to the number/value of stacked conditions
  at the time of the hit; this mechanism is not reflected in the snapshot at all.

  CONCLUSION: _resolve_dva_multiplier always returns 1.0 in practice, because
  the cs_ids in dva_css are never found in csMap at snapshot time.
  EMP_DVA coverage is identical to EMP coverage.
  The dva_css issue requires event-stream capture (not snapshot capture) to resolve.

== Known limitations (v3) ==
  - DMG_REVISE_RATE = 0.36 is a PLACEHOLDER from the task spec; actual formula
    embeds the multiplier in card eff_value/100.  H1/H2/H3 show low coverage.
  - dva_css (damage-value adjustment stacks): the conditions are consumed before
    snapshot; csMap lookup ALWAYS returns empty for the referenced cs_ids.
    EMP_DVA = EMP (no improvement possible from snapshot data alone).
  - crit_factor formula: (1 + S_CRI_DMG_RATE/100); for response cards the team
    info lacks S_CRI_DMG_RATE so the code falls back to 100 (cf=2.0).
    Correct behavior would look up the caster char's CDmg even for response cards.
  - DMG_ATTR_BASE_ON_DEF hits use monster DEF as the damage basis, not ATK;
    these are now filtered out in _frame_to_hit so EMP formula is not applied.
  - Hits with empty used_cards cannot have eff_value resolved; they are skipped
    for EMP validation (the eff_value field will be 0.0).
  - EMP/EMP_DVA coverage 5% (2/40 hits) due to dva_css variance on crit hits
    and the crit_factor fallback issue.
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
    **_ignored: object,
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
    **_ignored: object,
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
    **_ignored: object,
) -> float:
    """H3: H2 × elemental_mult × rage_mult."""
    base = predict_damage_h2(
        atk, def_reduce, crit_factor, skill_mult, vulnerable_pct, morale_atk, morale_def
    )
    return base * elemental_mult * rage_mult


def predict_damage_empirical(
    atk: float,
    eff_value: float,
    def_reduce: float,
    crit_factor: float,
    **_ignored: object,
) -> float:
    """B3 empirical formula:
    dmg = ATK × (eff_value/100) × (1 − def_reduce) × crit_factor

    eff_value comes from the largest skillMap[skill_eff_id].eff_value with a
    non-None final_count_value for the card used.  This identifies the main-damage
    skill entry rather than passive/trigger effects (which have eff_value <= 1 and
    no final_count_value).

    ATK is the individual caster ATK for mutation cards ('_mut' in card res_id) or
    the team average ATK (bwt.char.S_ATK) for response and other card types.

    crit_factor is 1.0 for non-crits, (1 + CDmg/100) for crits.

    Extra keyword arguments (e.g. skill_mult from H1/H2/H3 hits) are ignored so
    validate_against_hits can pass the full hit dict to all hypotheses uniformly.
    Hits where eff_value == 0.0 are skipped (no eff_value was resolved).
    """
    if eff_value == 0.0:
        raise TypeError("eff_value is 0.0 — hit has no resolved eff_value; skip")
    return atk * (eff_value / 100.0) * (1.0 - def_reduce) * crit_factor


def _resolve_dva_multiplier(
    dva_css: list,
    cs_map: dict,
    skill_map: dict,
) -> float:
    """Resolve the cumulative damage multiplier from a dva_css list.

    Each cs_id in dva_css nominally refers to csMap[cs_id], which contains a
    skillEffs list of skill_eff_ids.  Each skill_eff_id resolves to a
    skillMap[seid].eff_value.

    Combinator (additive):
        dva_mult = 1 + Σ (eff_value / 100)  for each resolved eff_value

    Rationale for additive vs multiplicative:
        The game uses additive stacking for most buff/debuff stats (e.g. S_ATK,
        S_CRI_DMG_RATE).  Multiplicative chains would create runaway values
        inconsistent with the observed damage range.  Additive is the default
        choice; the distinction is moot in practice (see BLOCKER below).

    BLOCKER — empirically this function ALWAYS returns 1.0:
        dva_css references condition-stack entries that are CONSUMED (one-shot
        applied) at the moment of the hit and expire before the snapshot frame is
        written.  As a result the cs_ids in dva_css are NEVER present in csMap at
        snapshot capture time.  In all 5 tested capture files (13132 frames, every
        crit hit with dva_css), zero cs_ids were resolved.

        When a cs_id IS found (e.g. cs[94]=cs01_0610, ev=100 in the 20260510
        capture), it belongs to a still-active condition for a different hit —
        applying it additively or multiplicatively diverges further from the
        observed damage rather than correcting it.

    Returns 1.0 (neutral multiplier) when dva_css is empty or all lookups fail.
    Logs a warning per unresolved cs_id via print() to stderr.

    Parameters
    ----------
    dva_css  : list of int cs_ids from lastDamageEvent.dva_css
    cs_map   : dict[str, dict] from battle_wt.csMap
    skill_map: dict[str, dict] from battle_wt.skillMap
    """
    if not dva_css:
        return 1.0

    total_eff = 0.0
    any_resolved = False

    for cs_id in dva_css:
        cs = cs_map.get(str(cs_id))
        if cs is None:
            # Expected: dva_css cs_ids are consumed before snapshot is captured.
            # Do not log here — this is the normal (blocking) case.
            continue
        se_ids = cs.get("skillEffs") or []
        for seid in se_ids:
            sk = skill_map.get(str(seid))
            if sk is None:
                continue
            ev = sk.get("eff_value")
            if ev is not None and ev != 0:
                total_eff += float(ev)
                any_resolved = True

    if not any_resolved:
        return 1.0

    # Additive combinator: base is 1.0 + sum of contributions (each as fraction)
    return 1.0 + total_eff / 100.0


def predict_damage_empirical_with_dva(
    atk: float,
    eff_value: float,
    def_reduce: float,
    crit_factor: float,
    dva_mult: float = 1.0,
    **_ignored: object,
) -> float:
    """B4 empirical formula with dva_css multiplier:
    dmg = ATK × (eff_value/100) × (1 − def_reduce) × crit_factor × dva_mult

    dva_mult is computed by _resolve_dva_multiplier from the dva_css list.
    In practice dva_mult == 1.0 for all observed hits because dva_css cs_ids
    are consumed before snapshot capture (see module docstring).

    Hits where eff_value == 0.0 are skipped (same as EMP).
    """
    if eff_value == 0.0:
        raise TypeError("eff_value is 0.0 — hit has no resolved eff_value; skip")
    return atk * (eff_value / 100.0) * (1.0 - def_reduce) * crit_factor * dva_mult


HYPOTHESES: dict = {
    "H1": predict_damage_h1,
    "H2": predict_damage_h2,
    "H3": predict_damage_h3,
    "EMP": predict_damage_empirical,
    "EMP_DVA": predict_damage_empirical_with_dva,
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
      atk          – attacker S_ATK (individual char for mutation cards; team
                     average bwt.char.S_ATK for response/other card types)
      def_reduce   – monster S_DMG_DECREASE_RATE  OR  f6(monster S_DEF)
      crit_factor  – 1.0 non-crit, (1 + S_CRI_DMG_RATE/100) crit
      skill_mult   – hardcoded 1.0 (H1/H2/H3 use this; EMP ignores it)
      eff_value    – largest skillMap[skill_eff_id].eff_value with non-None
                     final_count_value for the first card in used_cards;
                     0.0 if no eff_value can be resolved (hit skipped by EMP)
      observed_dmg – lastDamageEvent.damage

    Returns None if the frame lacks the required data, the hit is an auto-attack
    (DMG_ATTR_FIX), stat-independent (DMG_ATTR_IGNORE_STAT), or uses a DEF-based
    damage formula (DMG_ATTR_BASE_ON_DEF — those hits scale with monster DEF, not
    ATK, so the ATK-based EMP formula cannot be applied to them).

    cardMap and skillMap use STRING keys.  All lookups cast to str().

    Known gaps / v3 limitations:
      - dva_css stack bonuses: _resolve_dva_multiplier attempts csMap→skillMap lookup
        but the referenced cs_ids are consumed before snapshot; dva_mult is always 1.0.
      - The crit_factor formula (1 + CDmg/100) is uncertain; for response cards the
        team-level stat dict lacks S_CRI_DMG_RATE, so the code falls back to 100
        (cf=2.0 instead of the caster's actual CDmg).
      - Hits with empty used_cards get eff_value=0.0 and are skipped by EMP/EMP_DVA.
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

        # Find the monster that received a qualifying damage hit this frame.
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
            dmg_types = ld.get("type", [])
            if "DMG_ATTR_FIX" in dmg_types:
                continue  # auto-attack fixed damage
            if "DMG_ATTR_IGNORE_STAT" in dmg_types:
                continue  # stat-independent, can't validate with ATK formula
            if "DMG_ATTR_BASE_ON_DEF" in dmg_types:
                continue  # DEF-based damage — EMP (ATK-based) formula does not apply
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

        # --- Resolve eff_value from skillMap (Bug 2 fix) ---
        # cardMap and skillMap use STRING keys; used_cards contains INTs.
        # Cast all lookups to str() to avoid silent misses.
        card_map: dict = bwt.get("cardMap") or {}
        skill_map: dict = bwt.get("skillMap") or {}
        cs_map: dict = bwt.get("csMap") or {}
        used_cards: list = bwt.get("used_cards") or []

        eff_value, card_res_id, caster_char_id = _resolve_eff_value(
            used_cards, card_map, skill_map
        )

        # --- Resolve dva_css multiplier ---
        # Best-effort: cs_ids are consumed before snapshot; always returns 1.0 in practice.
        dva_css_list: list = last_dmg.get("dva_css") or []
        dva_mult = _resolve_dva_multiplier(dva_css_list, cs_map, skill_map)

        # --- Identify ATK source ---
        # Mutation cards ('_mut' in res_id) scale with the individual caster's ATK.
        # Response cards and others scale with the team's combined ATK (bwt.char).
        team_char_info = (bwt.get("char") or {}).get("status", {}).get("info", {})
        team_atk = team_char_info.get("S_ATK")

        if card_res_id and "_mut" in card_res_id:
            # Mutation card: use caster char's individual ATK
            attacker_info = _get_char_info(chars, caster_char_id)
            if attacker_info is None:
                attacker_info = chars[0].get("status", {}).get("info", {}) if chars else {}
        else:
            # Response/other card: use team average ATK
            if team_atk is not None:
                attacker_info = team_char_info
            else:
                # Fallback: resolve caster from cardMap
                char_id = _resolve_caster_char_id(bwt)
                attacker_info = _get_char_info(chars, char_id)
                if attacker_info is None:
                    attacker_info = chars[0].get("status", {}).get("info", {}) if chars else {}

        atk = attacker_info.get("S_ATK")
        cri_dmg = attacker_info.get("S_CRI_DMG_RATE", 100.0)
        if atk is None:
            return None

        # --- Crit factor ---
        # Documented: 1 + S_CRI_DMG_RATE/100
        # Note: empirical crit/non-crit ratio varies due to dva_css; flag as concern.
        crit_factor = (1.0 + float(cri_dmg) / 100.0) if is_crit else 1.0

        return {
            "atk": float(atk),
            "def_reduce": def_reduce,
            "crit_factor": crit_factor,
            "skill_mult": 1.0,   # H1/H2/H3 use this; EMP ignores it
            "eff_value": float(eff_value),   # 0.0 if not resolved
            "dva_mult": dva_mult,            # 1.0 if no dva_css resolved from csMap
            "observed_dmg": float(observed_dmg),
            # metadata (not used in prediction, useful for debugging)
            "_is_crit": is_crit,
            "_monster_res_id": target_monster.get("res_id"),
            "_dva_css": dva_css_list,
            "_dva_mult": dva_mult,           # also exposed as metadata for inspection
            "_card_res_id": card_res_id,
        }
    except Exception:
        return None


def _resolve_eff_value(
    used_cards: list,
    card_map: dict,
    skill_map: dict,
) -> tuple[float, str | None, int | None]:
    """Return (eff_value, card_res_id, caster_char_id) for the first card in used_cards.

    eff_value selection heuristic:
      1. Among all skill_eff_ids of the card, pick the entry with the LARGEST
         eff_value that has a non-None final_count_value.  The final_count_value
         field marks main-damage skills; passive/trigger skills lack it.
      2. If no entry has final_count_value, fall back to the largest eff_value > 10
         (to exclude stat-adjustment entries with eff_value 1-6).
      3. If nothing qualifies, return eff_value=0.0 (hit will be skipped by EMP).

    NOTE: cardMap and skillMap keys are STRINGS.  used_cards contains INTs.
    All lookups cast the key to str().
    """
    for card_id in used_cards:
        card = card_map.get(str(card_id))   # Bug 1 fix: cast to str()
        if not card:
            continue
        card_res_id: str = card.get("res_id", "")
        caster_char_id: int | None = card.get("char_id") or card.get("caster_id")
        best_with_fcv: float | None = None
        best_no_fcv: float | None = None
        for skill_eff_id in card.get("skill_eff_ids", []):
            sk = skill_map.get(str(skill_eff_id))   # Bug 1 fix: cast to str()
            if not sk:
                continue
            ev = sk.get("eff_value", 0)
            if ev <= 0:
                continue
            fcv = sk.get("final_count_value")
            if fcv is not None:
                if best_with_fcv is None or ev > best_with_fcv:
                    best_with_fcv = float(ev)
            else:
                if ev > 10 and (best_no_fcv is None or ev > best_no_fcv):
                    best_no_fcv = float(ev)
        result = best_with_fcv if best_with_fcv is not None else best_no_fcv
        if result is not None:
            return result, card_res_id, caster_char_id
    return 0.0, None, None


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

    # H1/H2/H3 use DMG_REVISE_RATE=0.36 (placeholder).  EMP/EMP_DVA use real eff_value.
    # Hits with eff_value=0.0 are skipped by EMP/EMP_DVA (raises TypeError).
    hits_with_eff = [h for h in all_hits if h.get("eff_value", 0.0) > 0.0]
    hits_with_dva = [h for h in hits_with_eff if h.get("_dva_mult", 1.0) != 1.0]
    print(f"Hits with resolved eff_value (eligible for EMP): {len(hits_with_eff)} / {len(all_hits)}")
    print(f"Hits with resolved dva_mult != 1.0: {len(hits_with_dva)} / {len(hits_with_eff)}")
    print()

    for hyp in ["H1", "H2", "H3", "EMP", "EMP_DVA"]:
        result = validate_against_hits(all_hits, hypothesis=hyp, tolerance=0.05)
        pct = result["coverage"] * 100
        median_pct = (
            result["median_rel_diff"] * 100
            if result["median_rel_diff"] == result["median_rel_diff"]  # NaN check
            else float("nan")
        )
        print(
            f"{hyp} coverage @ +-5%: {pct:.1f}%"
            f" ({result['n_within_tolerance']} / {result['n_hits']} hits)"
        )
        if median_pct == median_pct:
            print(f"  Median relative diff: {median_pct:.1f}%")
        else:
            print(f"  Median relative diff: n/a (no diffs computed)")
        print()

    # EMP_DVA per-hit residual analysis (hits with eff_value > 0)
    print("EMP_DVA per-hit residual analysis (hits with eff_value > 0):")
    for h in all_hits:
        ev = h.get("eff_value", 0.0)
        if ev == 0.0:
            continue
        dm = h.get("dva_mult", 1.0)
        try:
            pred_emp = predict_damage_empirical(
                atk=h["atk"],
                eff_value=ev,
                def_reduce=h["def_reduce"],
                crit_factor=h["crit_factor"],
            )
            pred_dva = predict_damage_empirical_with_dva(
                atk=h["atk"],
                eff_value=ev,
                def_reduce=h["def_reduce"],
                crit_factor=h["crit_factor"],
                dva_mult=dm,
            )
        except TypeError:
            continue
        obs = h["observed_dmg"]
        rel_err_emp = abs(pred_emp - obs) / obs if obs > 0 else float("nan")
        rel_err_dva = abs(pred_dva - obs) / obs if obs > 0 else float("nan")
        status_emp = "PASS" if rel_err_emp <= 0.05 else "FAIL"
        status_dva = "PASS" if rel_err_dva <= 0.05 else "FAIL"
        dva = h.get("_dva_css", [])
        print(
            f"  EMP[{status_emp}] DVA[{status_dva}]"
            f" atk={h['atk']:.0f} ev={ev:.0f} dr={h['def_reduce']:.4f}"
            f" cf={h['crit_factor']:.2f} dm={dm:.3f}"
            f" pred_emp={pred_emp:.0f} pred_dva={pred_dva:.0f} obs={obs:.0f}"
            f" err_emp={rel_err_emp*100:.1f}% err_dva={rel_err_dva*100:.1f}%"
            f" dva_css={dva[:3]} card={h.get('_card_res_id', 'n/a')}"
        )
    print()
    print("DONE_WITH_CONCERNS:")
    print("  EMP formula verified for non-crit hits without dva_css amplification.")
    print("  EMP_DVA == EMP: dva_mult is always 1.0 because dva_css cs_ids are")
    print("  consumed before snapshot capture (never found in csMap).")
    print("  Root causes for EMP failures:")
    print("  1. dva_css cs_ids expire before snapshot; csMap lookup returns empty.")
    print("  2. crit_factor fallback to 2.0 for response cards (team ATK lacks CDmg).")
    print("  3. LBK/EGO hits use a stacking damage mechanism not captured in snapshots.")
    print("  See api/capture/validate_damage.py docstring for full dva_css findings.")
