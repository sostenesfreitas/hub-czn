import type {
  ApiStatus, GameData, LoadResponse, MemoryFragment,
  SetupStatus, SetupActionResponse, CaptureStatus,
  CaptureStartRequest, CaptureStopResponse, RescueBanner,
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

  captureStatus: () => request<CaptureStatus>('/api/capture/status'),

  captureStart: (body: CaptureStartRequest) =>
    request('/api/capture/start', { method: 'POST', body: JSON.stringify(body) }),

  captureStop: () => request<CaptureStopResponse>('/api/capture/stop', { method: 'POST' }),

  captureSetRegion: (region: 'global' | 'asia') =>
    request<SetupActionResponse>('/api/capture/set-region', { method: 'POST', body: JSON.stringify({ region }) }),

  captureOpenSnapshots: () =>
    request<SetupActionResponse>('/api/capture/open-snapshots', { method: 'POST' }),

  rescueRecords: () => request<RescueBanner[]>('/api/rescue/records'),
}
