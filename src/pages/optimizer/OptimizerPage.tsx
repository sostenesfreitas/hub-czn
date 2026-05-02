import { useState, useRef, useEffect, useCallback } from 'react'
import { useApiPort } from '@/hooks/useApiPort'
import { api } from '@/lib/api'
import type { OptimizerConfig, OptimizeProgress, OptimizeResult } from '@/lib/types'
import { OptimizerPanel } from './OptimizerPanel'
import { ResultsArea } from './ResultsArea'

type JobState = 'idle' | 'running' | 'done' | 'cancelled' | 'error'

const DEFAULT_CONFIG: OptimizerConfig = {
  char_name: '',
  four_piece_sets: [],
  two_piece_sets: [],
  main_stat_4: null,
  main_stat_5: null,
  main_stat_6: null,
  top_percent: 100,
  include_equipped: true,
  excluded_heroes: [],
  max_results: 10,
}

export function OptimizerPage() {
  const port = useApiPort()
  const [config, setConfig] = useState<OptimizerConfig>(DEFAULT_CONFIG)
  const [jobState, setJobState] = useState<JobState>('idle')
  const [progress, setProgress] = useState<OptimizeProgress | null>(null)
  const [results, setResults] = useState<OptimizeResult[]>([])
  const [selectedRank, setSelectedRank] = useState<number | null>(null)
  const [jobError, setJobError] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  // Ref so WS onclose callback can read current jobState without stale closure
  const jobStateRef = useRef<JobState>('idle')
  jobStateRef.current = jobState

  // WebSocket: open on mount, reopen if port changes
  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)

    ws.onmessage = (e: MessageEvent) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(e.data as string) as Record<string, unknown>
      } catch {
        return
      }

      switch (msg.type) {
        case 'optimize.progress':
          setProgress({
            checked: msg.checked as number,
            total: msg.total as number,
            found: msg.found as number,
          })
          break
        case 'optimize.done':
          setResults(msg.results as OptimizeResult[])
          setJobState('done')
          setProgress(null)
          break
        case 'optimize.cancelled':
          setJobState('cancelled')
          setResults([])
          setProgress(null)
          break
        case 'optimize.error':
          setJobState('error')
          setJobError((msg.message as string) ?? 'Erro desconhecido')
          setProgress(null)
          break
      }
    }

    let intentionalClose = false
    ws.onclose = () => {
      if (!intentionalClose && jobStateRef.current === 'running') {
        setJobState('error')
        setJobError('Conexão perdida. Recarregue a página e tente novamente.')
        setProgress(null)
      }
    }

    return () => {
      intentionalClose = true
      ws.close()
    }
  }, [port])

  const handleConfigChange = useCallback((newConfig: OptimizerConfig) => {
    setConfig(newConfig)
    // Any config change while done resets the results
    if (jobStateRef.current === 'done') {
      setJobState('idle')
      setResults([])
      setSelectedRank(null)
    }
  }, [])

  const handleRun = useCallback(async () => {
    setRunError(null)
    setJobState('running')
    setProgress(null)
    setResults([])
    setSelectedRank(null)
    setJobError(null)
    try {
      await api.optimizeStart(config)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao iniciar otimização'
      setRunError(
        msg.includes('already running') ? 'Já existe uma otimização em andamento' : msg
      )
      setJobState('idle')
    }
  }, [config])

  const handleCancel = useCallback(async () => {
    await api.optimizeCancel().catch(() => {})
  }, [])

  const handleSelectRank = useCallback((rank: number) => {
    setSelectedRank((prev) => (prev === rank ? null : rank))
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <OptimizerPanel
        config={config}
        onChange={handleConfigChange}
        onRun={handleRun}
        onCancel={handleCancel}
        isRunning={jobState === 'running'}
        progress={progress}
        runError={runError}
      />
      <ResultsArea
        jobState={jobState}
        progress={progress}
        results={results}
        selectedRank={selectedRank}
        onSelectRank={handleSelectRank}
        jobError={jobError}
      />
    </div>
  )
}
