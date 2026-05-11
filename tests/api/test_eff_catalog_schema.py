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
