export interface Stat {
  name: string
  value: number
  formatted: string
  is_percentage: boolean
  roll_count: number
}

export interface MemoryFragment {
  id: number
  slot_num: number       // 1-6
  slot_name: string      // e.g. "Head"
  set_id: number
  set_name: string
  rarity_num: number     // 1=Common 2=Uncommon 3=Rare 4=Legendary
  rarity: string         // e.g. "Rare"
  level: number          // 0-15
  locked: boolean
  equipped_to: string | null
  gear_score: number
  potential_low: number
  potential_high: number
  main_stat: Stat | null
  substats: Stat[]       // up to 4
}

export interface ApiStatus {
  ok: boolean
  data_loaded: boolean
  fragments: number
  combatants: number
  loaded_file: string | null
}

export interface LoadResponse {
  ok: boolean
  fragments: number
  combatants: number
}

export interface GameData {
  sets: Record<string, { name: string; pieces: number; bonus: string; type: string }>
  stats: Record<string, unknown>
  characters: Record<string, unknown>
}
