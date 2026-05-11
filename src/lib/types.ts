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
  priority_score: number
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

export interface SetInfo {
  name: string
  pieces: number
  bonus: string
  type: string
  stat?: string
  value?: number
  icon_path?: string
}

export interface GameData {
  sets: Record<string, SetInfo>
  stats: Record<string, unknown>
  characters: Record<string, unknown>
}

export interface SetupStatus {
  admin: boolean
  mitmproxy: boolean
  mitmproxy_version: string | null
  certificate: boolean
  certificate_trusted: boolean
  can_write_hosts: boolean
  hosts_block_reason: string | null
}

export interface SetupActionResponse {
  ok: boolean
  error?: string
}

export interface CaptureStatus {
  running: boolean
  region: 'global' | 'asia'
  admin: boolean
  rescue_file: string | null
}

export interface CaptureStartRequest {
  region: 'global' | 'asia'
  debug: boolean
}

export interface CaptureStopResponse {
  ok: boolean
  file_path: string | null
  region: string
}

export interface RescuePull {
  pull_number: number
  res_id: number
  name: string
  rarity: number
  kind: string
  image_url: string
  pity: number
  is_featured: boolean
  timestamp: number
}

export interface RescueStats {
  total: number
  five_star: number
  four_star: number
  avg_pity_5: number
  avg_pity_4: number
  win_rate_50_50: number
  resources_spent: number
}

export interface RescueBanner {
  banner_name: string
  pulls: RescuePull[]
  stats: RescueStats
}

export interface CaptureLogMessage {
  level: 'info' | 'success' | 'error' | 'warning'
  message: string
  timestamp: string
}

export interface SubstatInfo {
  text: string
  name: string
  value: string
  roll_count: number
  efficiency?: number
}

export interface GearSlot {
  slot: string
  main_stat: string | null
  substats: SubstatInfo[]
  score: number | null
  set_name?: string | null
  set_id?: number | null
  slot_num?: number
  level?: number
  priority_score?: number | null
  potential_low?: number | null
  potential_high?: number | null
  equipped_to?: string | null
}

export interface FinalStats {
  ATK: number
  DEF: number
  HP: number
  CRate: number
  CDmg: number
  EHP: number
  AvgDMG: number
  ExtraDMG?: number
  Ego?: number
}

export interface BaseStats {
  s_atk: number
  s_def: number
  s_hp: number
  s_cri: number
  s_cri_dmg_rate: number
}

export interface CombatantStats {
  char_id: string
  gear_slots: GearSlot[]
  final_stats: FinalStats
  base_stats?: BaseStats | null
}

export interface Combatant {
  char_id: string
  name: string
  res_id: number
  level: number
  attribute: string
  class: string
  avg_gear_score: number
  portrait_url: string
  ego?: number
  partner_name?: string | null
  partner_res_id?: number | null
}

export interface ScoringPriorities {
  weights: Record<string, number>
}

export interface OptimizerConfig {
  char_name: string
  four_piece_sets: number[]
  two_piece_sets: number[]
  main_stat_4: string | null
  main_stat_5: string | null
  main_stat_6: string | null
  top_percent: number
  include_equipped: boolean
  excluded_heroes: string[]
  max_results: number
  stat_weights: Record<string, number> | null
  allow_wildcards: boolean
  min_priority_substats: number
  stat_constraints: Record<string, number> | null
}

export interface OptimizeProgress {
  checked: number
  total: number
  found: number
}

export interface OptimizeResult {
  rank: number
  score: number
  set_summary: string
  gear_slots: GearSlot[]
  final_stats: FinalStats
}

export interface EquipmentSet {
  id: number
  name: string
  pieces: number
  icon_path?: string
}

export interface AboutInfo {
  version: string
  github_url: string
  releases_url: string
  issues_url: string
}

export interface CharPreset {
  recommended_sets: number[]
  main_stat_4: string[]
  main_stat_5: string[]
  main_stat_6: string[]
  substats: string[]
  weights: Record<string, number>
}

export interface CardCharacter {
  char_res_id: number
  name: string
}

export interface CardEntry {
  card_id: string
  char_res_id: number | null
  name: string
  cost: number
  eff_value: number
  hits: number
  spark_count: number
  effect_types: string[]
}

export interface DeckInfo {
  deck_id: number
  name: string
  point: number
  card_count: number
  bookmark_slot: number
}

export interface SimulateRequest {
  char_name: string
  deck_id?: number | null
  morale: number
  use_sparks: boolean
  monster_def: number
  frightened: boolean
  exposed_stacks: number
  fortitude: boolean
}

export interface SimCardResult {
  card_id: string
  name: string
  spark_id: string | null
  cost: number
  eff_value: number
  hits: number
  normal_damage: number
  crit_damage: number
  avg_damage: number
  icon_path: string | null
}

export interface BattlePlayerChar {
  res_id: number | string
  atk: number
  def: number
  cri: number
  cri_dmg: number
}

export interface BattleRecord {
  capture_time: string
  enemy_def: number
  enemy_atk: number
  enemy_dmg_decrease: number
  battle_result: string | null
  mvp_res_id: string | null
  char_dpt: Record<string, number>
  player_chars: BattlePlayerChar[]
}

export interface CharAnalysis {
  res_id: string
  scale_stat: 'atk' | 'def'
  atk: number
  crate: number
  cdmg: number
  crit_factor: number
  dmg_per_100coeff: number
  priority: 'crate' | 'cdmg' | 'atk' | 'balanced'
  tip: string
  crate_gain_10pp: number
  cdmg_gain_30pct: number
  atk_gain_10pct: number
}

export interface BattleAnalytics {
  capture_time: string
  enemy_def: number
  def_factor: number
  battle_result: string | null
  chars: CharAnalysis[]
}

export interface OverviewSummary {
  total: number
  win_rate: number
  avg_enemy_def: number
  avg_team_dmg: number
  last_battle_time: string | null
}

export interface InsightCard {
  level: 'urgent' | 'warning' | 'positive'
  title: string
  description: string
  action: string
  char_res_id: string | null
  insight_key?: string
  params?: Record<string, number>
}

export interface CharTrend {
  res_id: string
  battle_count: number
  avg_dpt: number
  dpt_trend_pct: number
  dpt_sparkline: number[]
  latest_atk: number
  latest_crate: number
  latest_cdmg: number
  priority: 'crate' | 'cdmg' | 'atk' | 'balanced'
  breakeven_delta: number
}

export interface RecentResult {
  capture_time: string
  battle_result: string | null
  enemy_def: number
  total_team_dmg: number
  mvp_res_id: string | null
}

export interface BattleOverview {
  summary: OverviewSummary
  insights: InsightCard[]
  chars: CharTrend[]
  recent: RecentResult[]
}

export interface SimulateDamageResponse {
  char_name: string
  deck_id: number
  atk: number
  crate: number
  cdmg: number
  morale_stacks: number
  morale_mult: number
  crit_factor: number
  monster_def: number
  def_reduction: number
  frightened: boolean
  exposed_stacks: number
  fortitude: boolean
  buff_mult: number
  cards: SimCardResult[]
  total_normal: number
  total_crit: number
  total_avg: number
}

export interface DeckBuilderEpiphanyVariant {
  variant_id: string
  level: number
  name: string
  cost: number
  card_type: string | null
  tags: string[]
  description: string
}

export interface DeckBuilderCard {
  card: CardEntry
  copies: number
  group: 'starting' | 'epiphany' | 'ego'
  variants: DeckBuilderEpiphanyVariant[]
}

export interface DeckBuilderCombatantResponse {
  char_res_id: number
  character_name: string | null
  starting_cards: DeckBuilderCard[]
  epiphany_cards: DeckBuilderCard[]
  ego_skill: DeckBuilderCard | null
  missing_card_ids: string[]
}