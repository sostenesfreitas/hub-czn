from pathlib import Path

from scripts.ko_pipeline.extract_equipment import extract_equipment

FIXTURES = Path(__file__).parent / "fixtures" / "ko_pipeline"


def _run():
    return extract_equipment(
        relic_path=FIXTURES / "relic.json",
        text_ko_path=FIXTURES / "text_ko.json",
        text_en_path=FIXTURES / "text_en.json",
    )


def test_excludes_non_slot_relic_types():
    catalog = _run()
    ids = {e["id"] for e in catalog}
    assert ids == {"eq_test_w1", "eq_test_a1"}  # RELIC type excluded


def test_maps_relic_type_to_slot():
    catalog = {e["id"]: e for e in _run()}
    assert catalog["eq_test_w1"]["slot"] == "Weapon"
    assert catalog["eq_test_a1"]["slot"] == "Armor"


def test_maps_rarity():
    catalog = {e["id"]: e for e in _run()}
    assert catalog["eq_test_w1"]["rarity"] == "Legendary"
    assert catalog["eq_test_a1"]["rarity"] == "Rare"


def test_resolves_bilingual_name():
    catalog = {e["id"]: e for e in _run()}
    assert catalog["eq_test_w1"]["name"] == {"en": "Test Weapon", "pt-BR": "테스트 무기"}


def test_detemplatizes_descriptions_and_collects_jargon():
    catalog = {e["id"]: e for e in _run()}
    w1 = catalog["eq_test_w1"]
    assert w1["desc_en"] == "On Critical Hit, 50% chance to X Agony"
    assert w1["desc_ko"] == "치명타 시 50% 확률로 고통 X"
    assert w1["jargon_en"] == ["Agony"]
    assert w1["jargon_ko"] == ["고통"]


def test_records_icon_name():
    catalog = {e["id"]: e for e in _run()}
    assert catalog["eq_test_w1"]["icon_name"] == "relics/relic_9001"
