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
from dataclasses import dataclass, field

from api.simulator.replay.reconstructor import StateReconstructor


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
    error: str = ""


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

    def replay(self, reader) -> tuple[ReplaySummary, list[EventReport]]:
        summary = ReplaySummary()
        reports: list[EventReport] = []
        state = None
        pending_dispatches: list[EventReport] = []
        for event in reader.events():
            if event.skill_eff_ids and state is not None:
                for skill_eff_id in event.skill_eff_ids:
                    row = self._dispatch_one(event, skill_eff_id, state)
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
        if target_id is None:
            return None
        for m in snapshot.get("monsters", []):
            if str(m.get("id", "")) != str(target_id):
                continue
            lde = m.get("lastDamageEvent") or {}
            return int(lde.get("damage", 0) or 0) if "damage" in lde else None
        return None

    def _dispatch_one(self, event, skill_eff_id: str, state) -> EventReport:
        row = EventReport(seq=event.seq, skill_eff_id=skill_eff_id)
        try:
            inst = self._runtime._instances.get(skill_eff_id)
        except KeyError as e:
            row.status = "missing"
            row.error = str(e)
            return row
        row.eff_type = inst.eff_type
        caster = state.player_team[0] if state.player_team else None
        if caster is None:
            row.status = "no_target"
            row.error = "no caster"
            return row
        try:
            result = self._runtime.apply(skill_eff_id, caster, state)
        except Exception as e:
            row.status = "crashed"
            row.error = f"{type(e).__name__}: {e}"
            return row
        if getattr(result, "skipped", False):
            row.status = "no_target"
            row.error = getattr(result, "skip_reason", "")
            return row
        row.sim_damage = int(getattr(result, "damage", 0) or 0)
        row.target_id = getattr(result, "target_id", None)
        type_def = self._runtime._catalog.get(inst.eff_type) if hasattr(self._runtime, "_catalog") else None
        ref = (type_def or {}).get("effect", {}).get("formula_ref", "")
        if ref.startswith("F_UNKNOWN") or ref == "F_NOOP":
            row.status = "stub"
        else:
            row.status = "dispatched"
        return row

    @staticmethod
    def _extract_observed_damage(event, target_id) -> "int | None":
        """Read monster.lastDamageEvent.damage from the snapshot for the target.
        Kept for backwards-compat with existing tests; not called by replay()."""
        return ReplayHarness._extract_observed_damage_from_snapshot(event.snapshot, target_id)
