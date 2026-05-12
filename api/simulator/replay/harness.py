"""
ReplayHarness: walks CaptureEvents through the Sprint 1 Runtime and
records per-event categorized reports.

Split-frame protocol: dev_msg (SkillEff) and battle_wt arrive in separate
s2c frames.  The harness therefore:
  - State-update events  (is_state_update=True)  → re-sync state via
    reconstructor; resolve obs_damage for any pending dispatched rows.
  - Skill-fire events    (is_state_update=False)  → dispatch via runtime;
    park result in pending list until the next state-update snapshot.
"""
import dataclasses
import re
from dataclasses import dataclass, field

from api.game_data.cs_multipliers import CSMultiplierIndex
from api.simulator.replay.event_parser import (
    BattleEvent, SkillEffEvent,
)
from api.simulator.replay.reconstructor import StateReconstructor
from api.simulator.replay.state_accumulator import StateAccumulator
from api.simulator.state import MonsterState

_CHAR_PREFIX_RE = re.compile(r"^c_(\d+)_")
_MONSTER_PREFIX_RE = re.compile(r"^(\d{5,})_")  # e.g., 1006005_*
_CS_PREFIX_RE = re.compile(r"^(cs\d{2}_\d{4})")  # e.g., cs01_0808_01 -> cs01_0808


def _replace_seq(event, new_seq: int):
    """Return a copy of event with seq replaced — works for any frozen BattleEvent."""
    return dataclasses.replace(event, seq=new_seq)


@dataclass
class EventReport:
    """One row in the replay report."""
    seq: int
    skill_eff_id: str
    eff_type: str = ""
    status: str = "dispatched"      # dispatched | stub | missing | crashed | no_target
    sim_damage: int = 0
    obs_damage: int | None = None
    delta_pct: float | None = None
    target_id: str | None = None
    inferred_caster: bool = False
    error: str = ""
    dva_stacks_observed: dict[str, int] = field(default_factory=dict)
    resolution_path: int = 5  # Sprint 2g1: which _resolve_caster branch succeeded (1-5)


@dataclass
class ReplaySummary:
    total_events: int = 0
    crashed: int = 0
    dispatched_dmg_within_5pct: int = 0
    dispatched_dmg_outside_5pct: int = 0
    stubbed: int = 0
    missing_from_index: int = 0
    no_target: int = 0
    by_eff_type: dict[str, dict[str, int]] = field(default_factory=dict)

    def record(self, eff_type: str, status: str, delta_pct: float | None = None):
        self.total_events += 1
        slot = self.by_eff_type.setdefault(eff_type, {
            "dispatched": 0, "stub": 0, "missing": 0, "crashed": 0, "no_target": 0,
        })
        slot[status] = slot.get(status, 0) + 1
        if status == "crashed":
            self.crashed += 1
        elif status == "stub":
            self.stubbed += 1
        elif status == "missing":
            self.missing_from_index += 1
        elif status == "no_target":
            self.no_target += 1
        elif status == "dispatched" and delta_pct is not None:
            if abs(delta_pct) <= 0.05:
                self.dispatched_dmg_within_5pct += 1
            else:
                self.dispatched_dmg_outside_5pct += 1


class ReplayHarness:
    def __init__(self, runtime, reconstructor: StateReconstructor):
        self._runtime = runtime
        self._reconstructor = reconstructor
        self._cs_index: CSMultiplierIndex | None = None

    def _get_cs_index(self) -> CSMultiplierIndex:
        if self._cs_index is None:
            self._cs_index = CSMultiplierIndex()
        return self._cs_index

    def replay(self, reader) -> tuple[ReplaySummary, list[EventReport]]:
        summary = ReplaySummary()
        reports: list[EventReport] = []
        captured = list(reader.events())  # buffer once for two passes

        # Pre-pass: build accumulator with monotonic global seq.
        accumulator = StateAccumulator()
        global_seq = 0
        skill_eff_global_seq: dict[tuple[int, str], int] = {}
        for ce_idx, ce in enumerate(captured):
            renumbered: list[BattleEvent] = []
            for pe in ce.parsed_events:
                renumbered.append(_replace_seq(pe, global_seq))
                if isinstance(pe, SkillEffEvent):
                    skill_eff_global_seq[(ce_idx, pe.skill_eff_id)] = global_seq
                global_seq += 1
            accumulator.feed(renumbered)

        # Second pass: dispatch using accumulator state for dva_stacks.
        state = None
        pending_dispatches: list[EventReport] = []
        for ce_idx, event in enumerate(captured):
            if event.skill_eff_fires and state is not None:
                for fire in event.skill_eff_fires:
                    fire_seq = skill_eff_global_seq.get((ce_idx, fire.skill_eff_id))
                    seg_caster = None
                    if fire_seq is not None:
                        # Collect candidate unit_ids from state AND from the
                        # accumulator's own snapshot (covers targets not yet
                        # reconstructed into state, e.g. monsters hit by stacks
                        # before their snapshot appears).
                        unit_ids: set = set()
                        unit_ids.update(state.card_owner_lookup.values())
                        unit_ids.update(m.id for m in state.enemies)
                        unit_ids.update(c.id for c in state.player_team)
                        # Include any unit that already has stacks in accumulator
                        snap_idx = min(fire_seq, len(accumulator._snapshots) - 1)
                        if snap_idx >= 0 and accumulator._snapshots:
                            unit_ids.update(accumulator._snapshots[snap_idx].stack_state.keys())
                        dva: dict[str, dict[str, int]] = {}
                        for uid in unit_ids:
                            stacks = accumulator.stacks_at(fire_seq, uid)
                            if stacks:
                                dva[uid] = stacks
                        state.dva_stacks = dva
                        state.cs_multiplier_index = self._get_cs_index()
                        seg_caster = accumulator.caster_at(fire_seq)
                    else:
                        state.dva_stacks = {}
                        state.cs_multiplier_index = self._get_cs_index()
                    row = self._dispatch_one(event, fire, state, segment_caster=seg_caster)
                    reports.append(row)
                    summary.record(row.eff_type or "?", row.status, None)
                    if row.status == "dispatched":
                        pending_dispatches.append(row)
            if event.is_state_update:
                if state is None:
                    state = self._reconstructor.reconstruct(event.snapshot)
                else:
                    self._resolve_pending(pending_dispatches, event.snapshot, summary)
                    pending_dispatches = []
                    state = self._reconstructor.reconstruct(event.snapshot)
                # Sprint 2g3: enrich monster_history with synthetic monsters
                # seen via monster_use_card events. These monsters fired
                # skill_eff events but may never have appeared in any
                # snapshot battle_wt frame, so path 3's history fallback
                # (added in 2g2) needs explicit entries to resolve them.
                if state.monster_history is None:
                    state.monster_history = {}
                for synth_prefix in accumulator.synthetic_monsters_seen():
                    synth_key = f"{synth_prefix}_synth"
                    if synth_key not in state.monster_history:
                        state.monster_history[synth_key] = MonsterState(
                            id=f"synth_{synth_prefix}",
                            def_=0, hp=1, hp_current=1,
                            res_id=synth_key,
                        )
        return summary, reports

    @staticmethod
    def _resolve_pending(pending: list, snapshot: dict, summary) -> None:
        """Fill in obs_damage / delta_pct on pending dispatched rows using this snapshot.
        Then increment within/outside counters."""
        for row in pending:
            obs = ReplayHarness._extract_observed_damage_from_snapshot(snapshot, row.target_id)
            if obs is not None and obs > 0:
                row.obs_damage = obs
                row.delta_pct = (row.sim_damage - obs) / obs
                if abs(row.delta_pct) <= 0.05:
                    summary.dispatched_dmg_within_5pct += 1
                else:
                    summary.dispatched_dmg_outside_5pct += 1

    @staticmethod
    def _extract_observed_damage_from_snapshot(snapshot: dict, target_id) -> "int | None":
        """Read monster.lastDamageEvent.damage for the target, but skip
        auto-attack ticks (is_auto=true OR type contains DMG_ATTR_AUTO/FIX).
        These represent a separate game mechanic, not the player's skill hit.
        """
        if target_id is None:
            return None
        for m in snapshot.get("monsters", []):
            if str(m.get("id", "")) != str(target_id):
                continue
            lde = m.get("lastDamageEvent") or {}
            if "damage" not in lde:
                return None
            if lde.get("is_auto", False) is True:
                return None
            attr_types = lde.get("type") or []
            if isinstance(attr_types, list):
                auto_markers = {"DMG_ATTR_AUTO", "DMG_ATTR_FIX"}
                if any(t in auto_markers for t in attr_types):
                    return None
            return int(lde.get("damage", 0) or 0)
        return None

    def _dispatch_one(self, event, fire, state, segment_caster: "str | None" = None) -> EventReport:
        row = EventReport(seq=event.seq, skill_eff_id=fire.skill_eff_id)
        try:
            inst = self._runtime._instances.get(fire.skill_eff_id)
        except KeyError as e:
            row.status = "missing"
            row.error = str(e)
            return row
        row.eff_type = inst.eff_type
        caster, inferred, path_num = self._resolve_caster(
            fire.caster_id,
            state,
            skill_eff_id=fire.skill_eff_id,
            segment_caster=segment_caster,
        )
        row.inferred_caster = inferred
        row.resolution_path = path_num
        if caster is None:
            row.status = "no_target"
            row.error = "no caster"
            return row
        try:
            result = self._runtime.apply(fire.skill_eff_id, caster, state)
        except Exception as e:
            row.status = "crashed"
            row.error = f"{type(e).__name__}: {e}"
            return row
        if getattr(result, "skipped", False):
            row.status = "no_target"
            row.error = getattr(result, "skip_reason", "")
            return row
        row.sim_damage = int(getattr(result, "damage", 0) or 0)
        # prefer the fire's explicit target_id when present; fall back to runtime's
        row.target_id = fire.target_id or getattr(result, "target_id", None)
        row.dva_stacks_observed = dict(getattr(result, "dva_stacks_observed", {}) or {})
        type_def = self._runtime._catalog.get(inst.eff_type) if hasattr(self._runtime, "_catalog") else None
        ref = (type_def or {}).get("effect", {}).get("formula_ref", "")
        if ref.startswith("F_UNKNOWN") or ref == "F_NOOP":
            row.status = "stub"
        else:
            row.status = "dispatched"
        return row

    @staticmethod
    def _resolve_caster(
        caster_id: "str | None",
        state,
        skill_eff_id: "str | None" = None,
        segment_caster: "str | None" = None,
    ) -> tuple:
        """Resolve a caster unit.

        Resolution order:
        1. Direct match: caster_id == unit.id (player_team or enemies).
        2. Indirect via card_owner_lookup: caster_id is a card-instance-id.
        3. Skill-eff-id prefix: extract char_res_id from skill_eff_id (c_<N>_ or <N>_).
        4. Segment caster: chain SkillEffs (cs-prefix etc) attribute to the
           actor of the most recent UsedCardEvent (Sprint 2d's
           StateAccumulator.caster_at). Authoritative — not inferred.
        6. cs_map_raw lookup: for cs<NN>_<NNNN>_<NN> skill_eff_ids, scan
           state.cs_map_raw entries for matching res_id. If exactly one
           unique char_id is present, use it (Sprint 2g1). Authoritative.
        5. Fallback: player_team[0] with inferred=True.

        Returns (unit, inferred, path_num) where inferred=True if fallback was
        used and path_num (1-6) records which branch succeeded (Sprint 2g1).
        """
        # 1. Direct match
        if caster_id is not None:
            for unit in state.player_team:
                if str(unit.id) == str(caster_id):
                    return unit, False, 1
            for unit in state.enemies:
                if str(unit.id) == str(caster_id):
                    return unit, False, 1
            # 2. card_owner_lookup
            owner_id = state.card_owner_lookup.get(str(caster_id))
            if owner_id is not None:
                for unit in state.player_team:
                    if str(unit.id) == owner_id:
                        return unit, False, 2
                for unit in state.enemies:
                    if str(unit.id) == owner_id:
                        return unit, False, 2
        # 3. skill_eff_id prefix
        if skill_eff_id:
            char_match = _CHAR_PREFIX_RE.match(skill_eff_id)
            if char_match:
                char_res_id = char_match.group(1)
                for unit in state.player_team:
                    if unit.res_id == char_res_id:
                        return unit, False, 3
            else:
                mon_match = _MONSTER_PREFIX_RE.match(skill_eff_id)
                if mon_match:
                    mon_prefix = mon_match.group(1)
                    for unit in state.enemies:
                        # monster res_id is often like "1006005_01" — match starting prefix
                        if unit.res_id.startswith(mon_prefix):
                            return unit, False, 3
                    # Sprint 2g2: fall back to monster_history (monsters seen in
                    # earlier/later snapshots but not in the current frame).
                    history = getattr(state, "monster_history", None)
                    if history:
                        for hist_res_id, hist_unit in history.items():
                            if hist_res_id.startswith(mon_prefix):
                                return hist_unit, False, 3
        # 4. segment_caster from StateAccumulator.caster_at(fire_seq)
        if segment_caster is not None:
            for unit in state.player_team:
                if str(unit.id) == str(segment_caster):
                    return unit, False, 4
            for unit in state.enemies:
                if str(unit.id) == str(segment_caster):
                    return unit, False, 4
        # 6. cs_map_raw lookup for cs_* or eq_* skill_eff_ids (Sprint 2g1/2g2).
        # For cs_* ids: strip trailing _NN suffix to get the cs res_id base.
        # For eq_* ids: try the full skill_eff_id as res_id (eq_* entries in
        # cs_map_raw store res_id WITH the _NN suffix, e.g. eq_p_sec_003_01).
        # Match against cs_map_raw entries; if exactly one char_id, use it.
        if skill_eff_id:
            cs_map = getattr(state, "cs_map_raw", None)
            candidate_res_ids: list[str] = []
            if skill_eff_id.startswith("cs"):
                cs_match = _CS_PREFIX_RE.match(skill_eff_id)
                if cs_match:
                    candidate_res_ids.append(cs_match.group(1))
            elif skill_eff_id.startswith("eq_"):
                # Try full id first (eq_p_sec_003_01), then stripped (eq_p_sec_003)
                candidate_res_ids.append(skill_eff_id)
                stripped = re.sub(r"_\d{2}$", "", skill_eff_id)
                if stripped != skill_eff_id:
                    candidate_res_ids.append(stripped)
            elif re.match(r"^\d{5,}_", skill_eff_id):
                # Sprint 2g4: numeric-prefix monster-applied buffs
                # (e.g., 30094_c1_lv5_01_01). Try full id (might be exact
                # res_id) AND stripped form.
                candidate_res_ids.append(skill_eff_id)
                stripped = re.sub(r"_\d{2}$", "", skill_eff_id)
                if stripped != skill_eff_id:
                    candidate_res_ids.append(stripped)
            if candidate_res_ids and cs_map:
                for target_res_id in candidate_res_ids:
                    char_ids: set = set()
                    owner_ids: set = set()
                    for entry in cs_map.values():
                        if not isinstance(entry, dict):
                            continue
                        if str(entry.get("res_id", "")) == target_res_id:
                            cid = entry.get("char_id")
                            oid = entry.get("owner_id")
                            if cid is not None:
                                char_ids.add(str(cid))
                            if oid is not None:
                                owner_ids.add(str(oid))
                    # Sprint 2g4: prefer owner_id for monster-carried buffs.
                    # If owner_id matches a monster (or player), return it.
                    # This is the key signal for monster-applied buffs whose
                    # char_id points to the player who originally cast.
                    if len(owner_ids) == 1:
                        only_owner = next(iter(owner_ids))
                        # Prefer monster match (typical for monster-applied buffs)
                        for unit in state.enemies:
                            if str(unit.id) == only_owner:
                                return unit, False, 6
                        # Also try player match (for player-carried stacks)
                        for unit in state.player_team:
                            if str(unit.id) == only_owner:
                                return unit, False, 6
                    # Otherwise fall back to char_id resolution
                    if len(char_ids) == 1:
                        only = next(iter(char_ids))
                        for unit in state.player_team:
                            if str(unit.id) == only:
                                return unit, False, 6
                        for unit in state.enemies:
                            if str(unit.id) == only:
                                return unit, False, 6
        # 5. Fallback
        if state.player_team:
            return state.player_team[0], True, 5
        return None, True, 5

    @staticmethod
    def _extract_observed_damage(event, target_id) -> "int | None":
        """Read monster.lastDamageEvent.damage from the snapshot for the target.
        Kept for backwards-compat with existing tests; not called by replay()."""
        return ReplayHarness._extract_observed_damage_from_snapshot(event.snapshot, target_id)
