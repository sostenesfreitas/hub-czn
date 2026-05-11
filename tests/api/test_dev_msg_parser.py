"""Unit tests for dev_msg parser — extracts caster/target context per SkillEff fire."""
from api.simulator.replay.dev_msg_parser import parse_dev_msg, SkillEffFire


def test_extracts_skill_eff_with_no_context():
    """SkillEff outside any card_use segment has caster_id=None."""
    log = "**battle log : SkillEff 3:c_x_01:SKILL_EFF_DMG\n"
    fires = parse_dev_msg(log)
    assert len(fires) == 1
    assert fires[0].skill_eff_id == "c_x_01"
    assert fires[0].eff_type == "SKILL_EFF_DMG"
    assert fires[0].caster_id is None
    assert fires[0].target_id is None


def test_extracts_caster_from_preceding_card_use():
    log = """\
**battle log : --------card_use-start--------
**battle log : 103 used card 1006005_01_pt2_10
**battle log : SkillEff 5:1006005_01_pt2_10_01:SKILL_EFF_DMG
"""
    fires = parse_dev_msg(log)
    assert len(fires) == 1
    assert fires[0].caster_id == "103"


def test_extracts_target_from_added_to_line():
    log = """\
**battle log : --------card_use-start--------
**battle log : 1 used card c_1057_srt1
**battle log : 1(user) added cs00_0002 to 38(monster) value 2 sign MATHSIGN_ADD
**battle log : SkillEff 6:c_1057_srt1_01:SKILL_EFF_DMG
"""
    fires = parse_dev_msg(log)
    assert len(fires) == 1
    assert fires[0].caster_id == "1"
    assert fires[0].target_id == "38"


def test_multiple_segments_each_with_their_own_context():
    log = """\
**battle log : --------card_use-start--------
**battle log : 1 used card c_a
**battle log : SkillEff 1:c_a_01:SKILL_EFF_DMG
**battle log : --------card_use-start--------
**battle log : 2 used card c_b
**battle log : 2(user) added cs to 50(monster) value 1 sign MATHSIGN_ADD
**battle log : SkillEff 2:c_b_01:SKILL_EFF_DMG
"""
    fires = parse_dev_msg(log)
    assert len(fires) == 2
    assert fires[0].caster_id == "1"
    assert fires[0].target_id is None
    assert fires[1].caster_id == "2"
    assert fires[1].target_id == "50"


def test_skill_eff_with_params_after_type():
    log = "**battle log : SkillEff 3:c_x_01:SKILL_EFF_CS_SET_ADD:link_cs_id=[\"cs_a\"]\n"
    fires = parse_dev_msg(log)
    assert len(fires) == 1
    assert fires[0].skill_eff_id == "c_x_01"
    assert fires[0].eff_type == "SKILL_EFF_CS_SET_ADD"
