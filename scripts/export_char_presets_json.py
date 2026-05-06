import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))
from game_data.char_presets import _RAW, get_char_preset
output = {str(k): get_char_preset(k) for k in _RAW if get_char_preset(k)}
out = sys.argv[1] if len(sys.argv) > 1 else \
    os.path.join(os.path.dirname(__file__), '..', 'android-app', 'app', 'src', 'main', 'assets', 'char_presets.json')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w') as f:
    json.dump(output, f, indent=2)
print(f"Exported {len(output)} presets to {out}")
