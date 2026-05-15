"""Parametrized test bed: each synthetic fixture asserts predicted damage
matches the description-derived expectation within ±10%.

Also enforces a global ≥70% pass-rate gate across all auto-generated fixtures.
"""
import json
import random
from pathlib import Path

import pytest

from api.game_data.eff_instances import EffInstanceIndex
from api.simulator.replay.char_resolver import CharResolver
from api.simulator.replay.fixture_generator import generate_fixtures
from api.simulator.runtime import Runtime
from api.simulator.state import BattleState


REPO = Path(__file__).resolve().parents[2]
CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")
CATALOG_PATH = REPO / "api" / "data" / "eff_type_catalog.json"


def _all_fixtures():
    resolver = CharResolver()
    index = EffInstanceIndex(CLIENT_DB)
    return generate_fixtures(resolver, index)


_FIXTURES = _all_fixtures()
_RUNTIME = Runtime(
    catalog=json.loads(CATALOG_PATH.read_text(encoding="utf-8")),
    instances=EffInstanceIndex(CLIENT_DB),
)


def _expected_damage(fix) -> float:
    """Mirror runtime's _def_reduce: 268 / (DEF + 503)."""
    dr = 268.0 / (fix.target_state.def_ + 503.0)
    return fix.char_state.atk * (fix.expected_eff_pct / 100.0) * (1.0 - dr)


@pytest.mark.parametrize("fix", _FIXTURES, ids=lambda f: f.name)
def test_synth_card_damage_within_tolerance(fix):
    state = BattleState(
        turn=1,
        player_team=[fix.char_state],
        enemies=[fix.target_state],
        hand=[], deck=[], discard=[],
        morale=0,
        ego_state={}, spark_state={}, cs_stacks={},
        rng=random.Random(0),
    )
    result = _RUNTIME.apply(fix.skill_eff_id, fix.char_state, state)
    if getattr(result, "skipped", False):
        pytest.skip(f"runtime skipped: {result.skip_reason}")
    expected = _expected_damage(fix)
    if expected <= 0:
        pytest.skip("expected damage is 0")
    rel_err = abs(result.damage - expected) / expected
    assert rel_err <= 0.10, (
        f"sim={result.damage} expected≈{expected:.0f} err={rel_err:.1%} ({fix.name})"
    )


def test_majority_of_synth_fixtures_pass():
    """At least 70% of all fixtures must pass the per-fixture tolerance."""
    passed = 0
    failed = 0
    for fix in _FIXTURES:
        state = BattleState(
            turn=1, player_team=[fix.char_state], enemies=[fix.target_state],
            hand=[], deck=[], discard=[],
            morale=0, ego_state={}, spark_state={}, cs_stacks={},
            rng=random.Random(0),
        )
        try:
            result = _RUNTIME.apply(fix.skill_eff_id, fix.char_state, state)
        except Exception:
            failed += 1
            continue
        if getattr(result, "skipped", False):
            continue
        expected = _expected_damage(fix)
        if expected <= 0:
            continue
        if abs(result.damage - expected) / expected <= 0.10:
            passed += 1
        else:
            failed += 1
    total = passed + failed
    assert total > 0, "no fixtures evaluated"
    rate = passed / total
    assert rate >= 0.70, f"pass rate {rate:.1%} below 70% ({passed}/{total})"
