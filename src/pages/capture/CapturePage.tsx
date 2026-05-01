import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { api } from '@/lib/api'
import { useApiPort } from '@/hooks/useApiPort'
import { useCaptureLog } from '@/hooks/useCaptureLog'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Radio, Square, FolderOpen, Download } from 'lucide-react'
import type { CaptureLogMessage } from '@/lib/types'

const LEVEL_COLOR: Record<CaptureLogMessage['level'], string> = {
  success: '#4ade80',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#a09d96',
}

function PrereqBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${ok ? 'text-green-400' : 'text-red-400'}`}>
      {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
      {label}
    </span>
  )
}

export function CapturePage() {
  const port = useApiPort()
  const qc = useQueryClient()
  const { messages, clear } = useCaptureLog(port)
  const [autoScroll, setAutoScroll] = useState(true)
  const [debug, setDebug] = useState(false)
  const [region, setRegion] = useState<'global' | 'asia'>('global')
  const logRef = useRef<HTMLDivElement>(null)

  const { data: captureStatus } = useQuery({
    queryKey: ['capture-status'],
    queryFn: () => api.captureStatus(),
    refetchInterval: 3000,
  })

  const { data: setupStatus } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.setupStatus(),
    refetchInterval: 10000,
  })

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [messages, autoScroll])

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.message.toLowerCase().includes('saved:') && last.message.toLowerCase().includes('memory fragments')) {
      qc.invalidateQueries({ queryKey: ['fragments'] })
    }
  }, [messages, qc])

  useEffect(() => {
    if (captureStatus?.region) setRegion(captureStatus.region)
  }, [captureStatus?.region])

  const startMutation = useMutation({
    mutationFn: () => api.captureStart({ region, debug }),
    onSuccess: () => {
      clear()
      qc.invalidateQueries({ queryKey: ['capture-status'] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => api.captureStop(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capture-status'] }),
  })

  const regionMutation = useMutation({
    mutationFn: (r: 'global' | 'asia') => api.captureSetRegion(r),
  })

  const running = captureStatus?.running ?? false
  const isAdmin = captureStatus?.admin ?? false
  const prereqsOk = isAdmin && (setupStatus?.mitmproxy ?? false) && (setupStatus?.certificate ?? false)

  return (
    <div className="p-6 flex gap-6 h-full">
      <div className="w-60 shrink-0 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-[#faf9f5]">Capture</h1>

        <div className="p-3 rounded-lg bg-[#252320] border border-[#2e2c28] flex flex-col gap-2">
          <PrereqBadge ok={isAdmin} label="Admin" />
          <PrereqBadge ok={setupStatus?.mitmproxy ?? false} label="mitmproxy" />
          <PrereqBadge ok={setupStatus?.certificate ?? false} label="Certificado" />
          {!prereqsOk && (
            <NavLink to="/setup" className="text-xs text-[#cc785c] hover:underline mt-1">
              → Ir para Setup
            </NavLink>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#a09d96]">Servidor</label>
          <select
            value={region}
            disabled={running}
            onChange={e => {
              const r = e.target.value as 'global' | 'asia'
              setRegion(r)
              regionMutation.mutate(r)
            }}
            className="bg-[#252320] border border-[#2e2c28] rounded px-2 py-1.5 text-sm text-[#faf9f5] disabled:opacity-50"
          >
            <option value="global">Global</option>
            <option value="asia">Asia</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-[#a09d96] cursor-pointer">
          <input
            type="checkbox"
            checked={debug}
            disabled={running}
            onChange={e => setDebug(e.target.checked)}
            className="accent-[#cc785c]"
          />
          Debug mode
        </label>

        {!running ? (
          <Button
            onClick={() => startMutation.mutate()}
            disabled={!prereqsOk || startMutation.isPending}
            className="bg-[#cc785c] hover:bg-[#b8674d] text-white w-full"
          >
            <Radio size={14} className="mr-2" />
            Start Capture
          </Button>
        ) : (
          <Button
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white w-full"
          >
            <Square size={14} className="mr-2" />
            Stop Capture
          </Button>
        )}

        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-[#2e2c28] text-[#a09d96] hover:text-[#faf9f5] w-full justify-start"
            onClick={() => fetch(`http://127.0.0.1:${port}/api/capture/open-snapshots`, { method: 'POST' })}
          >
            <FolderOpen size={13} className="mr-2" />
            Abrir Snapshots
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!captureStatus?.rescue_file}
            className="border-[#2e2c28] text-[#a09d96] hover:text-[#faf9f5] w-full justify-start disabled:opacity-40"
            onClick={() => {
              if (captureStatus?.rescue_file) {
                api.load(captureStatus.rescue_file)
                  .then(() => qc.invalidateQueries({ queryKey: ['fragments'] }))
              }
            }}
          >
            <Download size={13} className="mr-2" />
            Carregar Último
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#a09d96]">Log em tempo real</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-[#a09d96] hover:text-[#faf9f5]"
              onClick={() => setAutoScroll(v => !v)}
            >
              {autoScroll ? 'Pausar scroll' : 'Retomar scroll'}
            </button>
            <button type="button" className="text-xs text-[#a09d96] hover:text-[#faf9f5]" onClick={clear}>
              Limpar
            </button>
          </div>
        </div>

        <div
          ref={logRef}
          className="flex-1 overflow-y-auto rounded-lg bg-[#0f0e0c] border border-[#2e2c28] p-3 font-mono text-xs leading-relaxed"
        >
          {messages.length === 0 && !running && (
            <div className="text-[#3d3d3a] space-y-1">
              <p>1. Clique em Start Capture</p>
              <p>2. Abra o jogo</p>
              <p>3. Navegue até o inventário de Memory Fragments</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ color: LEVEL_COLOR[m.level] }}>
              <span className="text-[#3d3d3a]">{m.timestamp} </span>
              {m.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
