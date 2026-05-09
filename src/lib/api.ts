import type {
  ApiStatus, GameData, LoadResponse, MemoryFragment,
  SetupStatus, SetupActionResponse, CaptureStatus,
  CaptureStartRequest, CaptureStopResponse, RescueBanner,
  Combatant, CombatantStats, ScoringPriorities,
  OptimizerConfig, EquipmentSet, AboutInfo, CharPreset,
  SimulateRequest, SimulateDamageResponse, DeckInfo,
  CardEntry, CardCharacter, BattleRecord, BattleAnalytics,
  BattleOverview,
} from './types'

let _port: number = Number(import.meta.env.VITE_API_PORT ?? 7842)

export function setApiPort(port: number): void {
  _port = port
}

function base(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  return envUrl ?? `http://127.0.0.1:${_port}`
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const hasBody = options?.body != null
  const res = await fetch(`${base()}${path}`, {
    ...options,
    headers: {
      ...(hasBody && { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail: string }).detail ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export function assetUrl(path: string): string {
  return `${base()}${path}`
}

export const api = {
  status: () => request<ApiStatus>('/api/status'),

  load: (path: string) =>
    request<LoadResponse>('/api/load', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  fragments: (params?: { slot?: number; set_id?: number; unequipped?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.slot != null) qs.set('slot', String(params.slot))
    if (params?.set_id != null) qs.set('set_id', String(params.set_id))
    if (params?.unequipped) qs.set('unequipped', 'true')
    const query = qs.toString() ? `?${qs}` : ''
    return request<MemoryFragment[]>(`/api/fragments${query}`)
  },

  gameData: () => request<GameData>('/api/game-data'),

  setupStatus: () => request<SetupStatus>('/api/setup/status'),

  installMitmproxy: () =>
    request<SetupActionResponse>('/api/setup/install-mitmproxy', { method: 'POST' }),

  generateCert: () =>
    request<SetupActionResponse>('/api/setup/generate-cert', { method: 'POST' }),

  openCert: () =>
    request<SetupActionResponse>('/api/setup/open-cert', { method: 'POST' }),

  installCertificate: () =>
    request<SetupActionResponse>('/api/setup/install-certificate', { method: 'POST' }),

  captureStatus: () => request<CaptureStatus>('/api/capture/status'),

  captureStart: (body: CaptureStartRequest) =>
    request('/api/capture/start', { method: 'POST', body: JSON.stringify(body) }),

  captureStop: () => request<CaptureStopResponse>('/api/capture/stop', { method: 'POST' }),

  captureSetRegion: (region: 'global' | 'asia') =>
    request<SetupActionResponse>('/api/capture/set-region', { method: 'POST', body: JSON.stringify({ region }) }),

  captureOpenSnapshots: () =>
    request<SetupActionResponse>('/api/capture/open-snapshots', { method: 'POST' }),

  autoscrollStart: (pagesCount: number) => request<{ ok: boolean }>('/api/autoscroll/start', { method: 'POST', body: JSON.stringify({ pages_count: pagesCount }) }),
  autoscrollStop:  () => request<{ ok: boolean }>('/api/autoscroll/stop',  { method: 'POST' }),
  combatantsExport: () => request<unknown[]>('/api/combatants/export'),

  rescueRecords: () => request<RescueBanner[]>('/api/rescue/records'),

  combatants: () => request<Combatant[]>('/api/combatants'),

  combatantStats: (charId: string) =>
    request<CombatantStats>(`/api/combatants/${encodeURIComponent(charId)}/stats`),

  scoringPriorities: () => request<ScoringPriorities>('/api/scoring/priorities'),

  saveScoringPriorities: (weights: Record<string, number>) =>
    request<ScoringPriorities>('/api/scoring/priorities', {
      method: 'POST',
      body: JSON.stringify({ weights }),
    }),

  optimizeSets: () => request<EquipmentSet[]>('/api/optimize/sets'),

  optimizeStart: (config: OptimizerConfig) =>
    request<{ job_id: string }>('/api/optimize/start', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  optimizeCancel: () =>
    request<{ cancelled: boolean }>('/api/optimize/cancel', { method: 'POST' }),

  about: () => request<AboutInfo>('/api/about'),

  simulateDamage: (body: SimulateRequest) =>
    request<SimulateDamageResponse>('/api/simulate/damage', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  simulateDecks: (charName: string) =>
    request<DeckInfo[]>(`/api/simulate/decks/${encodeURIComponent(charName)}`),

  cardCharacters: () => request<CardCharacter[]>('/api/cards/characters'),

  cards: (charResId?: number) => {
    const qs = charResId != null ? `?char_res_id=${charResId}` : ''
    return request<CardEntry[]>(`/api/cards${qs}`)
  },

  battleLatest: () => request<BattleRecord>('/api/battle/latest'),

  battleHistory: (limit = 20) =>
    request<BattleRecord[]>(`/api/battle/history?limit=${limit}`),

  battleAnalytics: () => request<BattleAnalytics>('/api/battle/analytics'),

  battleOverview: () => request<BattleOverview>('/api/battle/overview'),

  charPreset: (charId: number) =>
    request<CharPreset>(`/api/scoring/char-preset/${charId}`),

  charWeights: (charId: string) =>
    request<ScoringPriorities>(`/api/scoring/char-weights/${encodeURIComponent(charId)}`),

  saveCharWeights: (charId: string, weights: Record<string, number>) =>
    request<ScoringPriorities>(`/api/scoring/char-weights/${encodeURIComponent(charId)}`, {
      method: 'POST',
      body: JSON.stringify({ weights }),
    }),

  deleteCharWeights: (charId: string) =>
    request<{ ok: boolean }>(`/api/scoring/char-weights/${encodeURIComponent(charId)}`, {
      method: 'DELETE',
    }),
}
