"""
Memory Fragment set definitions for CZN.
Contains set bonus information and derived lists.
"""

_ICON = "/assets/pieces/icon_piece_set_{:03d}.png"

# Set definitions
SETS = {
    6:  {"name": "Conqueror's Aspect",   "pieces": 4, "bonus": "+35% Crit DMG of 1-cost cards",                                                           "type": "conditional", "icon_path": _ICON.format(6)},
    7:  {"name": "Tetra's Authority",    "pieces": 2, "bonus": "+12% Defense",                                                                             "type": "stat", "stat": "DEF%", "value": 12, "icon_path": _ICON.format(7)},
    8:  {"name": "Healer's Journey",     "pieces": 2, "bonus": "+12% Max HP",                                                                              "type": "stat", "stat": "HP%",  "value": 12, "icon_path": _ICON.format(8)},
    9:  {"name": "Black Wing",           "pieces": 2, "bonus": "+12% Attack",                                                                              "type": "stat", "stat": "ATK%", "value": 12, "icon_path": _ICON.format(9)},
    10: {"name": "Seth's Scarab",        "pieces": 2, "bonus": "+20% Basic Card DMG",                                                                      "type": "conditional", "icon_path": _ICON.format(10)},
    11: {"name": "Executioner's Tool",   "pieces": 2, "bonus": "+25% Crit Damage",                                                                         "type": "stat", "stat": "Crit DMG", "value": 25, "icon_path": _ICON.format(11)},
    12: {"name": "Instinctual Growth",   "pieces": 4, "bonus": "+20% Instinct DMG (4+ cards)",                                                             "type": "conditional", "icon_path": _ICON.format(12)},
    15: {"name": "Bullet of Order",      "pieces": 4, "bonus": "+10% Order DMG after Attack (2 max)",                                                      "type": "conditional", "icon_path": _ICON.format(15)},
    16: {"name": "Offering of the Void", "pieces": 4, "bonus": "+20% Void DMG after Exhaust (1 turn)",                                                     "type": "conditional", "icon_path": _ICON.format(16)},
    18: {"name": "Spark of Passion",     "pieces": 4, "bonus": "+20% Passion DMG after Upgrade (5 times)",                                                 "type": "conditional", "icon_path": _ICON.format(18)},
    19: {"name": "Cursed Corpse",        "pieces": 2, "bonus": "+10% DMG to targets inflicted with Agony",                                                 "type": "conditional", "icon_path": _ICON.format(19)},
    20: {"name": "Line of Justice",      "pieces": 4, "bonus": "+20% Crit Rate for cards that cost 2 or more",                                             "type": "conditional", "icon_path": _ICON.format(20), "two_piece": {"stat": "ATK%", "value": 17}},
    21: {"name": "Wireth's Steel",       "pieces": 4, "bonus": "2pc: +20% Defense | 4pc: +50% Counterattack DMG",                                         "type": "conditional", "two_piece": {"stat": "DEF%", "value": 20}},
    22: {"name": "Orb of Inhibition",    "pieces": 4, "bonus": "+30% DMG to Void cards with 2+ hits",                                                      "type": "conditional", "icon_path": _ICON.format(22)},
    23: {"name": "Judgment's Flames",    "pieces": 4, "bonus": "+50% Instinct DMG against Ravaged targets",                                                "type": "conditional", "icon_path": _ICON.format(23)},
    24: {"name": "Beast's Yearning",     "pieces": 4, "bonus": "+30% Justice and Order Attack Card DMG (max 5 per turn)",                                  "type": "conditional", "icon_path": _ICON.format(24)},
    25: {"name": "Glory's Reign",        "pieces": 4, "bonus": "When an Exhaust Skill Card is created or used, +5% ally DMG (max 15%)",                    "type": "conditional", "icon_path": _ICON.format(25)},
    26: {"name": "Prelude to a Hero",    "pieces": 4, "bonus": "When a Passion/Void Attack Card is Discarded, +15% Crit Chance for 1 turn (max 15%)",     "type": "conditional", "icon_path": _ICON.format(26)},
    27: {"name": "Starlight and Dreams", "pieces": 4, "bonus": "When Shield is gained via ability, +5% ally Counterattack/Extra Attack DMG (max 25%)",     "type": "conditional", "icon_path": _ICON.format(27)},
}

TWO_PIECE_SETS = [sid for sid, s in SETS.items() if s["pieces"] == 2]
FOUR_PIECE_SETS = [sid for sid, s in SETS.items() if s["pieces"] == 4]