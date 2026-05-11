"""FORMULA_REGISTRY: name -> callable(instance, caster, targets, state) -> EffectResult."""
from typing import Callable

FORMULA_REGISTRY: dict[str, Callable] = {}
