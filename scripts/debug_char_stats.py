"""Debug script: show predicted vs observed breakdown for one char."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))

from api.optimizer.optimizer import GearOptimizer
from api.capture.validate_stats import _build_gear
from game_data import get_character_name

snapshot_dir = Path(r"C:\Users\soste\AppData\Local\hub-czn\snapshots")
mf_path = sorted(snapshot_dir.glob("memory_fragments_*.json"), key=lambda p: p.stat().st_mtime)[-1]
print(f"Using: {mf_path.name}")

optimizer = GearOptimizer()
optimizer.load_data(str(mf_path))

# Find Heidemarie and Cassius in the JSONL
target_names = {"Heidemarie", "Cassius", "Magna"}
jsonl = snapshot_dir / "websocket_debug_20260509_111039.jsonl"

with jsonl.open("r", encoding="utf-8") as f:
    for line in f:
        try:
            obj = json.loads(line)
        except Exception:
            continue
        d = obj.get("data") or {}
        chars = d.get("chars")
        if not isinstance(chars, list):
            continue
        for char in chars:
            if not isinstance(char, dict):
                continue
            res_id = char.get("res_id", 0)
            if res_id < 0:
                continue
            name = get_character_name(res_id)
            if name not in target_names:
                continue
            eq = char.get("equipped_pieces")
            status = char.get("status", {})
            info = status.get("info") if isinstance(status, dict) else None
            if not eq or not info:
                continue

            gear = _build_gear(char)
            print(f"\n{'='*60}")
            print(f"Character: {name} (res_id={res_id}) L{char.get('level')}+{char.get('ascend')}")
            print(f"Pieces loaded: {len(gear)}")

            # Show char_info from optimizer
            if name in optimizer.character_info:
                ci = optimizer.character_info[name]
                print(f"  char_info: level={ci.level} ascend={ci.ascend} res_id={ci.res_id}")
                print(f"  friendship_bonus: {ci.friendship_bonus}")
            else:
                print(f"  !! {name} NOT in character_info")

            # Show gear details
            for i, piece in enumerate(gear):
                ps = piece.get_total_stats()
                print(f"  piece {i}: set={piece.set_id} main={piece.main_stat} stats={ps}")

            # Run prediction
            predicted = optimizer.calculate_build_stats(gear, name)
            print(f"  Predicted: ATK={predicted.get('ATK'):.2f} DEF={predicted.get('DEF'):.2f} HP={predicted.get('HP'):.2f} CRate={predicted.get('CRate'):.2f} CDmg={predicted.get('CDmg'):.2f}")
            print(f"  Observed:  ATK={info.get('S_ATK')} DEF={info.get('S_DEF')} HP={info.get('S_HP')} CRate={info.get('S_CRI')} CDmg={info.get('S_CRI_DMG_RATE')}")

            target_names.discard(name)
            if not target_names:
                break
        if not target_names:
            break
