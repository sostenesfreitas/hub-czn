"""
Fits the DEF reduction curve against observed (DEF, dmg_decrease) pairs.

Tries 4 candidate forms parameterized with the constants from
constant_meta(stat_formula): dmg_decrease_rate_0_value=-160, _curv_value=300.

Selects the form with the highest R^2.
"""
ZERO_VAL = -160.0
CURV_VAL = 300.0

# f1-f4: parameterized with constant_meta(stat_formula) values directly.
# These all increase with DEF but observed dmg_decrease decreases — they
# don't fit. Kept for reference and to prove the constants don't apply
# to S_DMG_DECREASE_RATE directly.
#
# f5: CURV_VAL / (d + CURV_VAL) — natural "decreases with DEF" shape that
# mirrors simulate.py's def_reduction formula. Uses known game constant.
# f6: 268 / (d + 503) — empirically fitted on 133 (DEF, dmg_decrease)
# pairs via least-squares. Constants 268, 503 don't map directly to
# constant_meta values; suggests S_DMG_DECREASE_RATE uses a separate
# constant set or is computed differently than the documented formula.
CANDIDATE_FORMS = {
    "f1": lambda d: max(0.0, min(1.0, (d + ZERO_VAL) / CURV_VAL)),
    "f2": lambda d: d / (d + CURV_VAL) if (d + CURV_VAL) > 0 else 0.0,
    "f3": lambda d: max(0.0, (d + ZERO_VAL) / (d + CURV_VAL)) if (d + CURV_VAL) > 0 else 0.0,
    "f4": lambda d: d / (d + CURV_VAL - ZERO_VAL) if (d + CURV_VAL - ZERO_VAL) > 0 else 0.0,
    "f5": lambda d: CURV_VAL / (d + CURV_VAL) if (d + CURV_VAL) > 0 else 0.0,
    "f6": lambda d: 268.0 / (d + 503.0) if (d + 503.0) > 0 else 0.0,
}


def _r_squared(observed: list[float], predicted: list[float]) -> float:
    if not observed:
        return float("-inf")
    mean = sum(observed) / len(observed)
    ss_res = sum((o - p) ** 2 for o, p in zip(observed, predicted))
    ss_tot = sum((o - mean) ** 2 for o in observed)
    return 1.0 - (ss_res / ss_tot) if ss_tot > 0 else float("-inf")


def fit_def_curve(pairs: list[tuple[int, float]]) -> dict:
    """Returns {best_form, r_squared, all_forms: {name: r2}}."""
    if not pairs:
        raise ValueError("empty pairs")
    defs = [p[0] for p in pairs]
    obs = [p[1] for p in pairs]
    scores = {}
    for name, fn in CANDIDATE_FORMS.items():
        pred = [fn(d) for d in defs]
        scores[name] = _r_squared(obs, pred)
    best = max(scores, key=scores.get)
    return {"best_form": best, "r_squared": scores[best], "all_forms": scores}


if __name__ == "__main__":
    import os
    from pathlib import Path
    from api.capture.extract_damage_pairs import extract_def_pairs

    snap = Path(os.environ.get("LOCALAPPDATA", "")) / "hub-czn" / "snapshots"
    pairs = extract_def_pairs(snap)
    print(f"Loaded {len(pairs)} pairs from {snap}")
    result = fit_def_curve(pairs)
    print(f"Best form: {result['best_form']} (R²={result['r_squared']:.4f})")
    print(f"All forms: {result['all_forms']}")
