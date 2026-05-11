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
    """generate_fixtures emits a side artifact recording skipped cards."""
    REPO = Path(__file__).resolve().parents[2]
    out = REPO / "docs" / "research" / "unparseable_descriptions.md"
    assert out.exists()


def test_expected_eff_pct_comes_from_inst_not_description(fixtures):
    """expected_eff_pct should be the unepiphanied baseline (from EffInstance),
    not the variant description's first percentage (which may include an
    epiphany bonus). For c_1040_srt4, baseline is 140 while L1 description
    parses to 210% (+50% epiphany bonus)."""
    by_card = {f.card_id: f for f in fixtures}
    f = by_card.get("c_1040_srt4")
    if f is None:
        pytest.skip("c_1040_srt4 not in fixtures")
    assert f.expected_eff_pct == 140
    # description_eff_pct may be 210 (epiphany-augmented) — captured for diagnostic
    if f.description_eff_pct is not None:
        assert f.description_eff_pct >= 140  # description never lower than baseline for this card


def test_description_baseline_alignment_diagnostic(fixtures):
    """Diagnostic: report how many fixtures have description_eff_pct matching
    expected_eff_pct (baseline). Mismatches indicate cards with epiphany
    bonuses baked into the default variant. NOT a hard gate — informational."""
    aligned = 0
    misaligned = 0
    no_desc = 0
    for f in fixtures:
        if f.description_eff_pct is None:
            no_desc += 1
            continue
        if f.description_eff_pct == f.expected_eff_pct:
            aligned += 1
        else:
            misaligned += 1
    total_with_desc = aligned + misaligned
    print(f"\n[Diagnostic] aligned={aligned} misaligned={misaligned} "
          f"no_desc={no_desc} alignment_rate={aligned / max(total_with_desc, 1):.1%}")
    # Sanity: SOMETHING should have a description
    assert total_with_desc > 0
