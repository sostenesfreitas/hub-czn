"""
ReplayHarness: walks CaptureEvents through the Sprint 1 Runtime and
records per-event categorized reports.
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

    def record(self, eff_type: str, status: str):
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


class ReplayHarness:
    def __init__(self, runtime, reconstructor: StateReconstructor):
        self._runtime = runtime
        self._reconstructor = reconstructor

    def replay(self, reader) -> tuple[ReplaySummary, list[EventReport]]:
        summary = ReplaySummary()
        reports: list[EventReport] = []
        state = None
        for event in reader.events():
            if state is None:
                state = self._reconstructor.reconstruct(event.snapshot)
                continue
            for skill_eff_id in event.skill_eff_ids:
                row = self._dispatch_one(event, skill_eff_id, state)
                reports.append(row)
                summary.record(row.eff_type or "?", row.status)
        return summary, reports

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
        type_def = self._runtime._catalog.get(inst.eff_type) if hasattr(self._runtime, "_catalog") else None
        ref = (type_def or {}).get("effect", {}).get("formula_ref", "")
        if ref.startswith("F_UNKNOWN") or ref == "F_NOOP":
            row.status = "stub"
        else:
            row.status = "dispatched"
        return row
