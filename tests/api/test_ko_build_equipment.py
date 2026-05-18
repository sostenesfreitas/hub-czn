from scripts.ko_pipeline.build_equipment import build_items


def test_build_produces_deck_builder_item_shape():
    catalog = [
        {
            "id": "eq_test_w1",
            "slot": "Weapon",
            "rarity": "Legendary",
            "icon_name": "relics/relic_9001",
            "name": {"en": "Test Weapon", "ko": "테스트 무기"},
            "desc_en": "On Critical Hit, 50% chance to X Agony",
            "desc_ko": "치명타 시 50% 확률로 고통 X",
            "jargon_en": ["Agony"],
            "jargon_ko": ["고통"],
        }
    ]
    translations = {"eq_test_w1": "Em acerto crítico, 50% de chance de aplicar X de Agonia"}
    old_images = {"Test Weapon": "itens/item_0042.webp"}

    items = build_items(catalog, translations, old_images)

    assert len(items) == 1
    it = items[0]
    assert it["id"] == "eq_test_w1"
    assert it["slot"] == "Weapon"
    assert it["rarity"] == "Legendary"
    assert it["name"] == "Test Weapon"
    assert it["description"] == {
        "en": "On Critical Hit, 50% chance to X Agony",
        "pt-BR": "Em acerto crítico, 50% de chance de aplicar X de Agonia",
    }
    assert it["image_path"] == "itens/item_0042.webp"  # carried over by name


def test_missing_image_falls_back_to_empty():
    catalog = [
        {
            "id": "eq_x",
            "slot": "Armor",
            "rarity": "Rare",
            "icon_name": "relics/relic_1",
            "name": {"en": "No Image Item", "ko": "..."},
            "desc_en": "d",
            "desc_ko": "d",
            "jargon_en": [],
            "jargon_ko": [],
        }
    ]
    items = build_items(catalog, {"eq_x": "d"}, old_images={})
    assert items[0]["image_path"] == ""


def test_english_falls_back_to_ko_translation_when_unused():
    catalog = [
        {
            "id": "eq_u",
            "slot": "Weapon",
            "rarity": "Rare",
            "icon_name": "i",
            "name": {"en": "U", "ko": "U"},
            "desc_en": "unused",
            "desc_ko": "진짜 설명",
            "jargon_en": [],
            "jargon_ko": [],
        }
    ]
    items = build_items(catalog, {"eq_u": "descrição real"}, old_images={})
    # broken EN ("unused") is replaced by the pt-BR translation
    assert items[0]["description"]["en"] == "descrição real"


def test_corrupt_en_uses_hand_authored_override():
    catalog = [
        {
            "id": "eq_pub_021",
            "slot": "Armor",
            "rarity": "Rare",
            "icon_name": "i",
            "name": {"en": "Titan", "ko": "..."},
            "desc_en": "When taking Damage, $RecoverXrev_0_0#% of Max HP",
            "desc_ko": "...",
            "jargon_en": [],
            "jargon_ko": [],
        }
    ]
    items = build_items(catalog, {"eq_pub_021": "texto pt"}, old_images={})
    en = items[0]["description"]["en"]
    assert "#" not in en and "$" not in en
    assert en == "When taking damage, recover X% of Max HP (once per turn)."
