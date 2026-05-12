"""
EventParser: turns dev_msg text into typed BattleEvents.

All events have monotonic seq (0-based) and raw_line for debugging.
Each event subclass captures the semantically interesting fields.

Recognized patterns (Sprint 2d scope):
- '--------card_use-start--------'   -> SegmentStartEvent
- '========card_use-end========'    -> SegmentEndEvent
- '<N> used card <res_id>'           -> UsedCardEvent
- '<N>(role) added <cs> to <M>(role2) value <V> sign <S>' -> StackAddEvent
- 'SkillEff <N>:<res_id>:<TYPE>'    -> SkillEffEvent
- '[condition_triggered] <id>:from_<source>' -> ConditionTriggeredEvent
- 'timing_changed:<TIMING>'          -> TimingEvent

skill_triggered / skill_usable_* are not emitted (no state mutation).
"""
import re
from dataclasses import dataclass
from typing import Union


@dataclass(frozen=True)
class _BaseEvent:
    seq: int
    raw_line: str


@dataclass(frozen=True)
class SegmentStartEvent(_BaseEvent):
    pass


@dataclass(frozen=True)
class SegmentEndEvent(_BaseEvent):
    pass


@dataclass(frozen=True)
class UsedCardEvent(_BaseEvent):
    actor_id: str = ""
    card_res_id: str = ""


@dataclass(frozen=True)
class StackAddEvent(_BaseEvent):
    actor_id: str = ""
    target_id: str = ""
    target_role: str = ""
    cs_id: str = ""
    value: int = 0
    sign: str = ""


@dataclass(frozen=True)
class SkillEffEvent(_BaseEvent):
    skill_eff_id: str = ""
    eff_type: str = ""
    seq_num: int = 0


@dataclass(frozen=True)
class ConditionTriggeredEvent(_BaseEvent):
    condition_id: str = ""
    source: str = ""


@dataclass(frozen=True)
class TimingEvent(_BaseEvent):
    timing: str = ""


BattleEvent = Union[
    SegmentStartEvent, SegmentEndEvent, UsedCardEvent, StackAddEvent,
    SkillEffEvent, ConditionTriggeredEvent, TimingEvent,
]


_RE_USED_CARD = re.compile(r"^(\d+)\s+used\s+card\s+(\S+)")
_RE_MONSTER_USE_CARD = re.compile(r"^monster_use_card\s+(\S+)")
_RE_STACK_ADD = re.compile(
    r"^(\d+)\((\w+)\)\s+added\s+(\S+)\s+to\s+(\d+)\((\w+)\)\s+value\s+(-?\d+)\s+sign\s+(\S+)"
)
_RE_SKILL_EFF = re.compile(r"^SkillEff\s+(\d+):([^:\s]+):([A-Z_][A-Z_0-9]*)")
_RE_CONDITION = re.compile(r"^\[condition_triggered\]\s+([^:]+):from_(\S+)")
_RE_TIMING = re.compile(r"^timing_changed:(\S+)")
_SEGMENT_START = "card_use-start"
_SEGMENT_END = "card_use-end"


def parse_dev_msg(dev_msg) -> list[BattleEvent]:
    """Walk dev_msg lines and emit BattleEvents in order."""
    if not isinstance(dev_msg, str) or not dev_msg:
        return []
    events: list[BattleEvent] = []
    seq = 0
    for raw_line in dev_msg.split("\n"):
        stripped = raw_line.strip()
        if not stripped.startswith("**battle log :"):
            continue
        body = stripped.split("battle log :", 1)[-1].strip()
        ev = _parse_body(seq, raw_line, body)
        if ev is not None:
            events.append(ev)
            seq += 1
    return events


def _parse_body(seq: int, raw_line: str, body: str) -> BattleEvent | None:
    if _SEGMENT_START in body:
        return SegmentStartEvent(seq=seq, raw_line=raw_line)
    if _SEGMENT_END in body:
        return SegmentEndEvent(seq=seq, raw_line=raw_line)
    m = _RE_USED_CARD.match(body)
    if m:
        return UsedCardEvent(
            seq=seq, raw_line=raw_line,
            actor_id=m.group(1), card_res_id=m.group(2),
        )
    m = _RE_MONSTER_USE_CARD.match(body)
    if m:
        # Sprint 2f6: parse monster_use_card lines.  Synthetic actor_id
        # 'monster_<res_id>' so the accumulator can distinguish a monster
        # caster from a player one (and clear segment_caster rather than
        # set it, since we don't have a monster unit_id mapping).
        res_id = m.group(1)
        return UsedCardEvent(
            seq=seq, raw_line=raw_line,
            actor_id=f"monster_{res_id}",
            card_res_id=res_id,
        )
    m = _RE_STACK_ADD.match(body)
    if m:
        try:
            value = int(m.group(6))
        except ValueError:
            value = 0
        return StackAddEvent(
            seq=seq, raw_line=raw_line,
            actor_id=m.group(1),
            target_id=m.group(4),
            target_role=m.group(5),
            cs_id=m.group(3),
            value=value,
            sign=m.group(7),
        )
    m = _RE_SKILL_EFF.match(body)
    if m:
        try:
            seq_num = int(m.group(1))
        except ValueError:
            seq_num = 0
        return SkillEffEvent(
            seq=seq, raw_line=raw_line,
            skill_eff_id=m.group(2), eff_type=m.group(3),
            seq_num=seq_num,
        )
    m = _RE_CONDITION.match(body)
    if m:
        return ConditionTriggeredEvent(
            seq=seq, raw_line=raw_line,
            condition_id=m.group(1).strip(), source=m.group(2),
        )
    m = _RE_TIMING.match(body)
    if m:
        return TimingEvent(seq=seq, raw_line=raw_line, timing=m.group(1))
    return None
