"""Unit tests for synthetic fixture generation."""
import random
from pathlib import Path

import pytest

from api.simulator.replay.char_resolver import CharResolver
from api.simulator.replay.fixture_generator import (
    SynthFixture, generate_fixtures,
)
from api.game_data.eff_instances import EffInstanceIndex


CLIENT_DB = Path(r"C:\Users\soste\Downloads\output\db")


@pytest.fixture(scope="module")
def fixtures():
    resolver = CharResolver()
    index = EffInstanceIndex(CLIENT_DB)
    return generate_fixtures(resolver, index)


def test_produces_at_least_50_fixtures(fixtures):
    assert len(fixtures) >= 50


def test_each_fixture_has_required_fields(fixtures):
    for f in fixtures[:10]:
        assert isinstance(f, SynthFixture)
        assert f.name
        assert f.card_id
        assert f.skill_eff_id
        assert f.expected_eff_pct is not None
        assert f.expected_eff_pct > 0
        assert f.char_state.atk > 0
        assert f.target_state.def_ > 0


def test_unparseable_audit_artifact_exists(fixtures):
    """generate_fixtures emits an unparseable_descriptions.md side artifact."""
    REPO = Path(__file__).resolve().parents[2]
    out = REPO / "docs" / "research" / "unparseable_descriptions.md"
    assert out.exists()
