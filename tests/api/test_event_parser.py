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


def test_used_card_event_extracted():
    log = "**battle log : 103 used card 1006005_01_pt2_10\n"
    events = parse_dev_msg(log)
    assert len(events) == 1
    e = events[0]
    assert isinstance(e, UsedCardEvent)
    assert e.actor_id == "103"
    assert e.card_res_id == "1006005_01_pt2_10"


def test_stack_add_event_extracted():
    log = "**battle log : 1(user) added cs00_0002 to 38(monster) value 2 sign MATHSIGN_ADD\n"
    events = parse_dev_msg(log)
    assert len(events) == 1
    e = events[0]
    assert isinstance(e, StackAddEvent)
    assert e.actor_id == "1"
    assert e.target_id == "38"
    assert e.target_role == "monster"
    assert e.cs_id == "cs00_0002"
    assert e.value == 2
    assert e.sign == "MATHSIGN_ADD"


def test_skill_eff_event_extracted():
    log = "**battle log : SkillEff 78:cs06_0166_02:SKILL_EFF_CARD_MOVE_TO\n"
    events = parse_dev_msg(log)
    assert len(events) == 1
    e = events[0]
    assert isinstance(e, SkillEffEvent)
    assert e.skill_eff_id == "cs06_0166_02"
    assert e.eff_type == "SKILL_EFF_CARD_MOVE_TO"
    assert e.seq_num == 78


def test_condition_triggered_event_extracted():
    log = "**battle log : [condition_triggered] cc_amt_han_abn_ge_0:from_cd_bombus_00\n"
    events = parse_dev_msg(log)
    assert len(events) == 1
    e = events[0]
    assert isinstance(e, ConditionTriggeredEvent)
    assert e.condition_id == "cc_amt_han_abn_ge_0"
    assert e.source == "cd_bombus_00"


def test_timing_event_extracted():
    log = "**battle log : timing_changed:TIMING_USE_CARD_AFTER\n"
    events = parse_dev_msg(log)
    assert len(events) == 1
    e = events[0]
    assert isinstance(e, TimingEvent)
    assert e.timing == "TIMING_USE_CARD_AFTER"


def test_seq_is_monotonic_across_mixed_events():
    log = (
        "**battle log : --------card_use-start--------\n"
        "**battle log : 103 used card X\n"
        "**battle log : 1(user) added cs00_0002 to 38(monster) value 2 sign MATHSIGN_ADD\n"
        "**battle log : SkillEff 5:abc_01:SKILL_EFF_DMG\n"
        "**battle log : ========card_use-end========\n"
    )
    events = parse_dev_msg(log)
    assert len(events) == 5
    assert [e.seq for e in events] == [0, 1, 2, 3, 4]


def test_parse_monster_use_card_emits_used_card_event():
    """Sprint 2f6 Feature 2: monster_use_card lines are parsed as UsedCardEvent
    with actor_id='monster_<res_id>' (synthetic prefix so the accumulator
    can distinguish player vs monster casters).
    """
    dev_msg = "**battle log : monster_use_card 1003009_01_pt1_00\n"
    events = parse_dev_msg(dev_msg)
    used_card_events = [e for e in events if isinstance(e, UsedCardEvent)]
    assert len(used_card_events) == 1
    assert used_card_events[0].actor_id == "monster_1003009_01_pt1_00"
    assert used_card_events[0].card_res_id == "1003009_01_pt1_00"
