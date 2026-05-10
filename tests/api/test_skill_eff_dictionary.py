import json, tempfile
from pathlib import Path
from api.capture.build_skill_eff_dictionary import parse_skill_eff_files
from api.capture.build_skill_eff_dictionary import cross_ref_observed_events, parse_dev_msg_skill_eff_lines


def test_parse_skill_eff_collects_distinct_eff_types():
    """Parser must aggregate eff_types across all input files into a single dict."""
    fake_a = [{"id": "eff_1", "eff_type": "ATK_UP", "value_x": "10", "value_y": "3"}]
    fake_b = [{"id": "eff_2", "eff_type": "BURN", "value_x": "100", "value_y": "2"},
              {"id": "eff_3", "eff_type": "ATK_UP", "value_x": "5", "value_y": "2"}]
    with tempfile.TemporaryDirectory() as td:
        (Path(td) / "card(a)@skill_eff.json").write_text(json.dumps(fake_a))
        (Path(td) / "card(b)@skill_eff.json").write_text(json.dumps(fake_b))
        result = parse_skill_eff_files(Path(td))
    assert "ATK_UP" in result
    assert "BURN" in result
    assert len(result["ATK_UP"]["instances"]) == 2
    assert len(result["BURN"]["instances"]) == 1


def test_parse_dev_msg_skill_eff_lines_extracts_types():
    """Parse 'SkillEff N:res:TYPE' patterns from a dev_msg blob."""
    dev_msg = (
        "**battle log : skill_triggered : 64:cs01_1084_01\n"
        "**battle log : SkillEff 107:rr_lux_01_01_01:SKILL_EFF_DMG_IGNORE_COND\n"
        "**battle log : SkillEff 200:c_1057_uni1:SKILL_EFF_DMG\n"
        "**battle log : SkillEff 300:c_1057_srt1:SKILL_EFF_DMG\n"
    )
    types = parse_dev_msg_skill_eff_lines(dev_msg)
    assert types == ["SKILL_EFF_DMG_IGNORE_COND", "SKILL_EFF_DMG", "SKILL_EFF_DMG"]


def test_cross_ref_increments_observed_count():
    """When dev_msg events contain a type, dict entry's observed_count increments."""
    static_dict = {
        "SKILL_EFF_DMG": {"instances": [], "params_keys": [], "source_files": [], "instance_count": 0},
        "SKILL_EFF_HEAL": {"instances": [], "params_keys": [], "source_files": [], "instance_count": 0},
    }
    fake_types = ["SKILL_EFF_DMG", "SKILL_EFF_DMG", "SKILL_EFF_NONEXISTENT"]
    result = cross_ref_observed_events(static_dict, fake_types)
    assert result["SKILL_EFF_DMG"]["observed_count"] == 2
    assert result["SKILL_EFF_HEAL"]["observed_count"] == 0
    # Note: SKILL_EFF_NONEXISTENT is not added to result (only annotates existing entries)
