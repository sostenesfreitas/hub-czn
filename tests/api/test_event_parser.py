"""Unit tests for dev_msg event_parser."""
from api.simulator.replay.event_parser import (
    parse_dev_msg,
    SegmentStartEvent, SegmentEndEvent, UsedCardEvent, StackAddEvent,
    SkillEffEvent, ConditionTriggeredEvent, TimingEvent,
)


def test_empty_input_returns_empty_list():
    assert parse_dev_msg("") == []
    assert parse_dev_msg(None) == []  # type: ignore


def test_unrecognized_lines_dont_emit_events():
    log = "**battle log : skill_usable_true : c_1057_srt1_01\n"
    assert parse_dev_msg(log) == []


def test_segment_markers_emit_events():
    log = (
        "**battle log : --------card_use-start--------\n"
        "**battle log : ========card_use-end========\n"
    )
    events = parse_dev_msg(log)
    assert len(events) == 2
    assert isinstance(events[0], SegmentStartEvent)
    assert isinstance(events[1], SegmentEndEvent)
    assert events[0].seq == 0
    assert events[1].seq == 1
