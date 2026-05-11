"""
SynthFixture generator: walks the deck_builder manifest and emits one
fixture per card with a SKILL_EFF_DMG instance.

`expected_eff_pct` reflects the unepiphanied baseline read from the client
db (matches `CardEntry.eff_value` from api/routes/cards). The variant
description's parsed percentage is captured separately in
`description_eff_pct` for diagnostic comparison — useful for detecting
cards whose default variant has an epiphany bonus baked in (e.g. cards
with [Retain]/[Initiation]/[Quietus] tags whose L1 variant adds +50%).

Cards skipped (no SKILL_EFF_DMG instance, no char base stats) are recorded
in docs/research/unparseable_descriptions.md.
"""
from dataclasses import dataclass
from pathlib import Path

from api.game_data.scaling import get_char_base_stats
from api.simulator.state import CharState, MonsterState


REPO = Path(__file__).resolve().parents[3]
UNPARSEABLE_PATH = REPO / "docs" / "research" / "unparseable_descriptions.md"

FIXTURE_LEVEL = 60
FIXTURE_ASCEND = 5
DUMMY_DEF = 300
DUMMY_HP = 99999


@dataclass
class SynthFixture:
    name: str
    char_state: CharState
    target_state: MonsterState
    card_id: str
    skill_eff_id: str
    expected_eff_pct: int                       # baseline from inst.eff_value
    description_eff_pct: int | None             # parsed variant description text
    expected_target_class: str | None
    expected_scaling: str | None


def generate_fixtures(char_resolver, instances) -> list[SynthFixture]:
    fixtures: list[SynthFixture] = []
    skipped: list[tuple[int, str, str, str]] = []

    for char_info in char_resolver.all_chars():
        all_card_ids = (
            char_info.starting_card_ids
            + char_info.epiphany_card_ids
            + ([char_info.ego_card_id] if char_info.ego_card_id else [])
        )
        for card_id in all_card_ids:
            inst = _find_dmg_instance_for_card(instances, card_id)
            if inst is None:
                skipped.append((
                    char_info.char_res_id,
                    char_info.name,
                    card_id,
                    "no SKILL_EFF_DMG instance in client db",
                ))
                continue
            if inst.eff_value <= 0:
                skipped.append((
                    char_info.char_res_id,
                    char_info.name,
                    card_id,
                    f"instance eff_value is {inst.eff_value}",
                ))
                continue
            try:
                base = get_char_base_stats(
                    str(char_info.char_res_id),
                    level=FIXTURE_LEVEL,
                    ascend=FIXTURE_ASCEND,
                )
            except KeyError:
                skipped.append((
                    char_info.char_res_id,
                    char_info.name,
                    card_id,
                    "no entry in char_base_l1.json",
                ))
                continue
            exp = char_resolver.card_expectation(card_id)
            char_state = CharState(
                id=str(char_info.char_res_id),
                atk=int(base.get("ATK", 0)),
                def_=int(base.get("DEF", 0)),
                hp=int(base.get("HP", 0)),
                hp_current=int(base.get("HP", 0)),
                cri=float(base.get("CRate", 0)),
                cri_dmg_rate=float(base.get("CDmg", 0)),
            )
            target = MonsterState(
                id="dummy",
                def_=DUMMY_DEF,
                hp=DUMMY_HP,
                hp_current=DUMMY_HP,
                dmg_decrease_rate=0.0,
            )
            fixtures.append(SynthFixture(
                name=f"{char_info.name}_{card_id}",
                char_state=char_state,
                target_state=target,
                card_id=card_id,
                skill_eff_id=inst.id,
                expected_eff_pct=inst.eff_value,
                description_eff_pct=exp.eff_pct if exp else None,
                expected_target_class=exp.target_class if exp else None,
                expected_scaling=exp.scaling_stat if exp else None,
            ))

    _write_skipped(skipped)
    return fixtures


def _find_dmg_instance_for_card(instances, card_id: str):
    """Return the FIRST SKILL_EFF_DMG instance whose id starts with card_id_."""
    prefix = card_id + "_"
    for inst in instances.by_type("SKILL_EFF_DMG"):
        if inst.id.startswith(prefix):
            return inst
    return None


def _write_skipped(items: list[tuple[int, str, str, str]]) -> None:
    UNPARSEABLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Cards skipped during synthetic fixture generation",
        "",
        "These cards lack a SKILL_EFF_DMG instance, or have no scaling data,",
        "or have a zero eff_value. Sprint 2c may extend coverage to dual-eff",
        "cards (CS_SET_ADD + DMG combos) and ego-skill cards.",
        "",
        "| char_res_id | char | card_id | reason |",
        "|---|---|---|---|",
    ]
    for char_id, name, card_id, reason in items:
        lines.append(f"| {char_id} | {name} | `{card_id}` | {reason} |")
    UNPARSEABLE_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
