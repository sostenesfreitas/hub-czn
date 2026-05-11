"""Validation tests for api/data/eff_type_catalog.json against its JSON Schema."""
import json
from pathlib import Path

import jsonschema
import pytest

REPO = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO / "api" / "data" / "eff_type_catalog.schema.json"
CATALOG_PATH = REPO / "api" / "data" / "eff_type_catalog.json"


def test_schema_is_valid_json_schema():
    """The schema file itself must be a valid JSON Schema draft-07 document."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    jsonschema.Draft7Validator.check_schema(schema)


def test_minimal_catalog_validates():
    """A catalog with one well-formed entry must pass schema validation."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    sample = {
        "SKILL_EFF_DMG": {
            "category": "damage",
            "trigger": "on_skill_use",
            "target_resolution": "selected_unit",
            "effect": {"kind": "deal_damage", "formula_ref": "F_BASE_DMG"},
            "stack_rule": "instant",
            "params_used": ["eff_value"],
            "confidence": "confirmed",
            "observed_count": 3051,
            "client_instances": 1362,
            "linked_conditions": [],
            "linked_cs_ids": [],
            "notes": "",
            "todos": [],
        }
    }
    jsonschema.validate(instance=sample, schema=schema)


def test_invalid_category_rejected():
    """Schema must reject unknown enum values."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    bad = {
        "SKILL_EFF_FOO": {
            "category": "not_a_real_category",
            "trigger": "on_skill_use",
            "target_resolution": "selected_unit",
            "effect": {"kind": "deal_damage", "formula_ref": "F_BASE_DMG"},
            "stack_rule": "instant",
            "params_used": [],
            "confidence": "confirmed",
            "observed_count": 0,
            "client_instances": 0,
            "linked_conditions": [],
            "linked_cs_ids": [],
            "notes": "",
            "todos": [],
        }
    }
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance=bad, schema=schema)


def test_missing_required_field_rejected():
    """A valid-shape entry missing a required field must fail."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    body = {
        "category": "damage",
        # trigger intentionally missing
        "target_resolution": "selected_unit",
        "effect": {"kind": "deal_damage", "formula_ref": "F_BASE_DMG"},
        "stack_rule": "instant",
        "params_used": [],
        "confidence": "confirmed",
        "observed_count": 0,
        "client_instances": 0,
        "linked_conditions": [],
        "linked_cs_ids": [],
        "notes": "",
        "todos": [],
    }
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance={"SKILL_EFF_X": body}, schema=schema)


def test_negative_observed_count_rejected():
    """observed_count below 0 must fail."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    body = {
        "category": "damage", "trigger": "on_skill_use", "target_resolution": "selected_unit",
        "effect": {"kind": "deal_damage", "formula_ref": "F_BASE_DMG"},
        "stack_rule": "instant", "params_used": [], "confidence": "confirmed",
        "observed_count": -1, "client_instances": 0,
        "linked_conditions": [], "linked_cs_ids": [], "notes": "", "todos": [],
    }
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance={"SKILL_EFF_X": body}, schema=schema)


def test_unknown_property_at_entry_level_rejected():
    """An entry with a typo'd field name (e.g., 'trgger') must fail."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    body = {
        "category": "damage", "trigger": "on_skill_use", "target_resolution": "selected_unit",
        "effect": {"kind": "deal_damage", "formula_ref": "F_BASE_DMG"},
        "stack_rule": "instant", "params_used": [], "confidence": "confirmed",
        "observed_count": 0, "client_instances": 0,
        "linked_conditions": [], "linked_cs_ids": [], "notes": "", "todos": [],
        "linked_cs_ds": [],  # typo of linked_cs_ids
    }
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance={"SKILL_EFF_X": body}, schema=schema)


def test_unknown_property_in_effect_rejected():
    """An effect with extra property must fail."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    body = {
        "category": "damage", "trigger": "on_skill_use", "target_resolution": "selected_unit",
        "effect": {"kind": "deal_damage", "formula_ref": "F_BASE_DMG", "amount": 100},
        "stack_rule": "instant", "params_used": [], "confidence": "confirmed",
        "observed_count": 0, "client_instances": 0,
        "linked_conditions": [], "linked_cs_ids": [], "notes": "", "todos": [],
    }
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(instance={"SKILL_EFF_X": body}, schema=schema)


def test_generated_catalog_validates():
    """The catalog produced by scripts/build_eff_catalog_scaffold.py must validate."""
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    assert len(catalog) >= 40, "scope shrank unexpectedly"
    jsonschema.validate(instance=catalog, schema=schema)
