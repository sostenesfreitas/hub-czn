"""
StateAccumulator: processes BattleEvents in order, maintaining a running
state snapshot per event index for offline replay queries.

Mutation events handled:
- UsedCardEvent -> updates current_segment_caster
- SegmentStartEvent / SegmentEndEvent -> clear current_segment_caster
- StackAddEvent -> mutates stack_state via MATHSIGN_* handler
- TimingEvent -> updates current_timing (advisory only in Sprint 2d)
- SkillEffEvent / ConditionTriggeredEvent -> recorded, no state mutation

Queries return snapshot data at a given seq:
- stacks_at(before_seq, unit_id) -> stack dict immediately BEFORE that event
- caster_at(seq) -> caster active when that event's snapshot was taken
- lookup_at(seq) -> card_owner_lookup state at that snapshot
"""
from dataclasses import dataclass, field

from api.simulator.replay.event_parser import (
    BattleEvent, SegmentStartEvent, SegmentEndEvent, UsedCardEvent,
    StackAddEvent, SkillEffEvent, TimingEvent, ConditionTriggeredEvent,
)


@dataclass
class AccumulatedState:
    seq: int
    stack_state: dict[str, dict[str, int]]
    card_owner_lookup: dict[str, str]
    current_segment_caster: str | None
    current_timing: str | None


_SIGN_HANDLERS = {
    "MATHSIGN_ADD": lambda cur, v: cur + v,
    "MATHSIGN_SUBTRACT": lambda cur, v: cur - v,
    "MATHSIGN_SUBTRACT_MIN_0": lambda cur, v: max(0, cur - v),
    "MATHSIGN_SET": lambda cur, v: v,
    "MATHSIGN_MULTIPLY": lambda cur, v: cur * v,
}


def _apply_sign(current: int, value: int, sign: str) -> int:
    handler = _SIGN_HANDLERS.get(sign, _SIGN_HANDLERS["MATHSIGN_ADD"])
    return handler(current, value)


class StateAccumulator:
    def __init__(self, initial_lookup: dict[str, str] | None = None):
        self._lookup_seed: dict[str, str] = dict(initial_lookup or {})
        self._snapshots: list[AccumulatedState] = []
        self._stacks: dict[str, dict[str, int]] = {}
        self._lookup: dict[str, str] = dict(self._lookup_seed)
        self._segment_caster: str | None = None
        self._timing: str | None = None

    def feed(self, events: list[BattleEvent]) -> None:
        for ev in events:
            self._apply(ev)
            self._snapshots.append(self._snapshot_at(ev.seq))

    def stacks_at(self, before_seq: int, unit_id: str) -> dict[str, int]:
        if before_seq <= 0:
            return {}
        idx = before_seq - 1
        if idx >= len(self._snapshots):
            idx = len(self._snapshots) - 1
        if idx < 0:
            return {}
        return dict(self._snapshots[idx].stack_state.get(str(unit_id), {}))

    def caster_at(self, seq: int) -> str | None:
        if seq < 0 or not self._snapshots:
            return None
        idx = min(seq, len(self._snapshots) - 1)
        return self._snapshots[idx].current_segment_caster

    def lookup_at(self, seq: int) -> dict[str, str]:
        if not self._snapshots:
            return dict(self._lookup)
        idx = min(max(seq, 0), len(self._snapshots) - 1)
        return dict(self._snapshots[idx].card_owner_lookup)

    def _apply(self, ev: BattleEvent) -> None:
        if isinstance(ev, SegmentStartEvent):
            self._segment_caster = None
        elif isinstance(ev, SegmentEndEvent):
            # Sprint 2f6: don't clear segment_caster on SegmentEnd. Chain
            # effects fired AFTER the segment ends should still attribute
            # to the actor of the most recent UsedCardEvent.  Cleared by
            # next SegmentStartEvent or overwritten by next UsedCardEvent.
            pass
        elif isinstance(ev, UsedCardEvent):
            self._segment_caster = ev.actor_id
        elif isinstance(ev, StackAddEvent):
            # Sprint 2f3: resolve card-instance-id → player char id via lookup
            raw = str(ev.target_id)
            unit = self._lookup.get(raw, raw)
            stacks = self._stacks.setdefault(unit, {})
            current = stacks.get(ev.cs_id, 0)
            new_value = _apply_sign(current, ev.value, ev.sign)
            if new_value <= 0:
                stacks.pop(ev.cs_id, None)
            else:
                stacks[ev.cs_id] = new_value
        elif isinstance(ev, TimingEvent):
            self._timing = ev.timing
        elif isinstance(ev, SkillEffEvent):
            pass
        elif isinstance(ev, ConditionTriggeredEvent):
            pass

    def _snapshot_at(self, seq: int) -> AccumulatedState:
        return AccumulatedState(
            seq=seq,
            stack_state={u: dict(s) for u, s in self._stacks.items()},
            card_owner_lookup=dict(self._lookup),
            current_segment_caster=self._segment_caster,
            current_timing=self._timing,
        )
