from __future__ import annotations

import json
from pathlib import Path

from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()

from fastapi import APIRouter

try:
    from game_data import CHARACTERS, PARTNERS
except ImportError:
    CHARACTERS = {}
    PARTNERS = {}

router = APIRouter()

PITY_CAP = 70
LOCAL_FACE_BASE = "/assets/game/faces/bookmark_face_character_map_{res_id}.png"


def _char_details(res_id: int) -> dict:
    char = CHARACTERS.get(res_id)
    if char:
        return {
            "name": char.get("name", f"#{res_id}"),
            "rarity": char.get("grade", 3),
            "kind": "Combatant",
            "image_url": LOCAL_FACE_BASE.format(res_id=res_id),
        }
    partner = PARTNERS.get(res_id)
    if partner and partner.get("name") != "Unknown":
        return {
            "name": partner.get("name", f"#{res_id}"),
            "rarity": partner.get("grade", 3),
            "kind": "Partner",
            "image_url": LOCAL_FACE_BASE.format(res_id=res_id),
        }
    return {
        "name": f"#{res_id}",
        "rarity": 3,
        "kind": "Unknown",
        "image_url": LOCAL_FACE_BASE.format(res_id=res_id),
    }


def _banner_name(gacha_id: str) -> str:
    if "pickup_combatant" in gacha_id:
        return "Seasonal Combatant Rescue Rate-Up"
    if "pickup_partner" in gacha_id:
        return "Seasonal Partner Rescue Rate-Up"
    if "pickup_supporter" in gacha_id or "supporter" in gacha_id:
        return "Gacha Pickup Supporter"
    if "free" in gacha_id:
        return "Free Rescue"
    if "standard" in gacha_id or "normal" in gacha_id:
        return "Standard Rescue"
    return gacha_id.replace("_", " ").title()


def _expand_batch(record: dict) -> list[dict]:
    try:
        rewards = json.loads(record.get("reward", "[]"))
    except (json.JSONDecodeError, TypeError):
        rewards = []
    try:
        prisms = json.loads(record.get("prism", "[]"))
    except (json.JSONDecodeError, TypeError):
        prisms = []

    gacha_id = record.get("gacha_id", "")
    try:
        ts = int(record.get("createAt", 0))
    except (ValueError, TypeError):
        ts = 0

    return [
        {
            "res_id": int(r),
            "gacha_id": gacha_id,
            "timestamp": ts,
            "is_featured": bool(prisms[i]) if i < len(prisms) else False,
        }
        for i, r in enumerate(rewards)
    ]


def _process_records(raw: list[dict]) -> list[dict]:
    """Group raw rescue records by banner, compute stats, return API shape."""
    all_pulls = []
    for rec in raw:
        all_pulls.extend(_expand_batch(rec))
    all_pulls.sort(key=lambda p: p["timestamp"])

    banners: dict[str, list[dict]] = {}
    for pull in all_pulls:
        name = _banner_name(pull["gacha_id"])
        banners.setdefault(name, []).append(pull)

    result = []
    for banner_name, pulls in banners.items():
        processed_pulls = []
        pity = 0
        pull_number = 0
        five_stars = 0
        four_stars = 0
        wins_50_50 = 0
        five_star_opportunities = 0

        for p in pulls:
            pull_number += 1
            pity += 1
            details = _char_details(p["res_id"])
            rarity = details["rarity"]

            pull_entry = {
                "pull_number": pull_number,
                "res_id": p["res_id"],
                "name": details["name"],
                "rarity": rarity,
                "kind": details["kind"],
                "image_url": details["image_url"],
                "pity": min(pity, PITY_CAP),
                "is_featured": p["is_featured"] if rarity >= 5 else False,
                "timestamp": p["timestamp"],
            }

            if rarity >= 5:
                five_stars += 1
                five_star_opportunities += 1
                if p["is_featured"]:
                    wins_50_50 += 1
                pity = 0
            elif rarity >= 4:
                four_stars += 1

            processed_pulls.append(pull_entry)

        total = len(pulls)
        processed_pulls.reverse()

        result.append({
            "banner_name": banner_name,
            "pulls": processed_pulls,
            "stats": {
                "total": total,
                "five_star": five_stars,
                "four_star": four_stars,
                "avg_pity_5": round(total / five_stars, 1) if five_stars else 0,
                "avg_pity_4": round(total / four_stars, 1) if four_stars else 0,
                "win_rate_50_50": round(wins_50_50 / five_star_opportunities, 4) if five_star_opportunities else 0,
                "resources_spent": total * 160,
            },
        })

    return result


def _latest_rescue_file() -> Path | None:
    """Find the most recently modified rescue_records_*.json in the snapshots folder."""
    try:
        from capture.constants import OUTPUT_DIR
        files = sorted(OUTPUT_DIR.glob("rescue_records_*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
        return files[0] if files else None
    except Exception:
        return None


@router.get("/rescue/records")
def get_rescue_records():
    path = _latest_rescue_file()
    if path is None:
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        records = raw.get("records", []) if isinstance(raw, dict) else raw
        return _process_records(records)
    except Exception:
        return []
