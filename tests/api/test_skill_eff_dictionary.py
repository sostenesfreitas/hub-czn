import json, tempfile
from pathlib import Path
from api.capture.build_skill_eff_dictionary import parse_skill_eff_files


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
