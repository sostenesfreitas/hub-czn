"""Unit tests for StateAccumulator."""
from api.simulator.replay.event_parser import (
    UsedCardEvent, SegmentStartEvent, SegmentEndEvent, StackAddEvent,
    SkillEffEvent, TimingEvent,
)
from api.simulator.replay.state_accumulator import (
    StateAccumulator, AccumulatedState,
)


def _stack_add(seq: int, target_id: str, cs_id: str, value: int, sign: str = "MATHSIGN_ADD"):
    return StackAddEvent(
        seq=seq, raw_line="",
        actor_id="1", target_id=target_id, target_role="monster",
        cs_id=cs_id, value=value, sign=sign,
    )


def test_empty_feed_returns_empty_state():
    acc = StateAccumulator()
    acc.feed([])
    assert acc.stacks_at(0, "38") == {}


def test_stack_add_accumulates():
    acc = StateAccumulator()
    acc.feed([
        _stack_add(0, "38", "cs_91", 2),
        _stack_add(1, "38", "cs_91", 3),
    ])
    # stacks_at(2) = state after events at seq 0 and 1 applied
    assert acc.stacks_at(2, "38") == {"cs_91": 5}


def test_stack_subtract_min_0_floors_to_zero():
    acc = StateAccumulator()
    acc.feed([
        _stack_add(0, "38", "cs_91", 2),
        _stack_add(1, "38", "cs_91", 5, sign="MATHSIGN_SUBTRACT_MIN_0"),
    ])
    # 2 - 5 = -3, floored at 0 -> key removed
    assert acc.stacks_at(2, "38") == {}


def test_stack_set_overrides():
    acc = StateAccumulator()
    acc.feed([
        _stack_add(0, "38", "cs_91", 2),
        _stack_add(1, "38", "cs_91", 10, sign="MATHSIGN_SET"),
    ])
    assert acc.stacks_at(2, "38") == {"cs_91": 10}


def test_stacks_at_returns_state_before_seq():
    """stacks_at(N) returns state AFTER events with seq < N have applied,
    i.e., immediately BEFORE the event with seq N."""
    acc = StateAccumulator()
    acc.feed([
        _stack_add(0, "38", "cs_a", 1),
        _stack_add(1, "38", "cs_b", 2),
        _stack_add(2, "38", "cs_c", 3),
    ])
    assert acc.stacks_at(0, "38") == {}
    assert acc.stacks_at(1, "38") == {"cs_a": 1}
    assert acc.stacks_at(2, "38") == {"cs_a": 1, "cs_b": 2}


def test_caster_at_picks_up_used_card():
    acc = StateAccumulator()
    acc.feed([
        SegmentStartEvent(seq=0, raw_line=""),
        UsedCardEvent(seq=1, raw_line="", actor_id="103", card_res_id="X"),
    ])
    assert acc.caster_at(1) == "103"


def test_segment_end_clears_caster():
    acc = StateAccumulator()
    acc.feed([
        SegmentStartEvent(seq=0, raw_line=""),
        UsedCardEvent(seq=1, raw_line="", actor_id="103", card_res_id="X"),
        SegmentEndEvent(seq=2, raw_line=""),
    ])
    assert acc.caster_at(2) is None


def test_initial_lookup_seed_preserved():
    acc = StateAccumulator(initial_lookup={"7": "1", "54": "103"})
    acc.feed([])
    assert acc.lookup_at(0) == {"7": "1", "54": "103"}


def test_stack_add_resolves_card_inst_id_via_lookup():
    """Sprint 2f3: when dev_msg's StackAddEvent target_id is a card-instance-id
    that maps to a player char id via card_owner_lookup, the accumulator
    stores stacks under the resolved player char id (not the raw card-inst-id).

    This is what fixes the c_1052_uni4_lbk Track B oracle: dev_msg adds
    'cs01_0805 to 21(card:c_1052_uni4_lbk)' should store stacks on player 38
    (Narja), not under card-inst-id 21.
    """
    acc = StateAccumulator(initial_lookup={"21": "38"})
    acc.feed([
        _stack_add(0, "21", "cs01_0805", 1),
    ])
    # Stacks land under resolved id "38" (player char Narja), NOT raw "21"
    assert acc.stacks_at(1, "38") == {"cs01_0805": 1}
    assert acc.stacks_at(1, "21") == {}


def test_stack_add_falls_back_to_raw_when_target_not_in_lookup():
    """When target_id is not in card_owner_lookup (e.g., direct adds to a
    monster id like '39'), the accumulator stores under the raw target_id.
    Backwards-compat with all pre-2f3 tests."""
    acc = StateAccumulator(initial_lookup={"21": "38"})
    acc.feed([
        _stack_add(0, "39", "cs00_0002", 1),
    ])
    # "39" not in lookup → falls back to raw "39"
    assert acc.stacks_at(1, "39") == {"cs00_0002": 1}
    assert acc.stacks_at(1, "21") == {}
    assert acc.stacks_at(1, "38") == {}
