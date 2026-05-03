import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { api } from '@/lib/api'
import { useApiPort } from '@/hooks/useApiPort'
import { useCaptureLog } from '@/hooks/useCaptureLog'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Radio, Square, FolderOpen, Download, Loader2 } from 'lucide-react'
import type { CaptureLogMessage, CaptureStatus } from '@/lib/types'

const LEVEL_COLOR: Record<CaptureLogMessage['level'], string> = {
  success: '#4ade80',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#b3b3b3',
}

function PrereqBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${ok ? 'text-green-400' : 'text-red-400'}`}>
      {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
      {label}
    </span>
  )
}

function MutationError({ error }: { error: unknown }) {
  const { t } = useTranslation()
  if (!error) return null
  const msg = error instanceof Error ? error.message : t('common.unexpectedError')
  return <p className="text-[#f3727f] text-xs mt-1">{msg}</p>
}

type AutoScrollPhase = 'idle' | 'countdown' | 'running' | 'done' | 'stopped'

function AutoScrollPanel({ port }: { port: number }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<AutoScrollPhase>('idle')
  const [countdown, setCountdown] = useState(3)
  const [pages, setPages] = useState(0)
  const [records, setRecords] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as Record<string, unknown>
        switch (msg.type) {
          case 'autoscroll.countdown':
            setCountdown(msg.seconds as number)
            setPhase('countdown')
            break
          case 'autoscroll.progress':
            setPages(msg.pages as number)
            setRecords(msg.records as number)
            setPhase('running')
            break
          case 'autoscroll.done':
            setPages(msg.pages as number)
            setRecords(msg.records as number)
            setPhase('done')
            break
          case 'autoscroll.stopped':
            setPages(msg.pages as number)
            setRecords(msg.records as number)
            setPhase('stopped')
            break
        }
      } catch { /* ignore */ }
    }
    return () => ws.close()
  }, [port])

  async function start() {
    setError(null)
    try {
      await api.autoscrollStart()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('capture.autoscroll.startError'))
    }
  }

  async function stop() {
    setError(null)
    try {
      await api.autoscrollStop()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('capture.autoscroll.stopError'))
    }
  }

  return (
    <div className="p-3 rounded-lg bg-[#181818] border border-[#282828] flex flex-col gap-2">
      <p className="text-xs text-[#666666] uppercase tracking-wider">{t('capture.autoscroll.title')}</p>

      {phase === 'idle' && (
        <button
          type="button"
          onClick={start}
          className="bg-[#c084fc] hover:bg-[#9333ea] text-white text-xs rounded px-3 py-1.5 text-left transition-colors"
        >
          {t('capture.autoscroll.start')}
        </button>
      )}

      {phase === 'countdown' && (
        <p className="text-xs text-[#b3b3b3]">
          {t('capture.autoscroll.position')}{' '}
          <span className="text-[#c084fc] font-bold">{countdown}</span>
        </p>
      )}

      {phase === 'running' && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#b3b3b3] flex items-center gap-1.5">
            <Loader2 size={10} className="animate-spin shrink-0" />
            {t('capture.autoscroll.progress', { pages, records })}
          </span>
          <button
            type="button"
            onClick={stop}
            className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0"
          >
            {t('capture.autoscroll.stop')}
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#4ade80] flex items-center gap-1">
            <CheckCircle size={10} className="shrink-0" />
            {t('capture.autoscroll.done', { pages, records })}
          </span>
          <button
            type="button"
            onClick={() => setPhase('idle')}
            className="text-xs text-[#b3b3b3] hover:text-[#ffffff] shrink-0"
          >
            {t('capture.autoscroll.restart')}
          </button>
        </div>
      )}

      {phase === 'stopped' && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#b3b3b3]">
            {t('capture.autoscroll.stopped', { pages, records })}
          </span>
          <button
            type="button"
            onClick={() => setPhase('idle')}
            className="text-xs text-[#b3b3b3] hover:text-[#ffffff] shrink-0"
          >
            {t('capture.autoscroll.restart')}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-[#f3727f]">{error}</p>}
    </div>
  )
}

export function CapturePage() {
  const { t } = useTranslation()
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
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['capture-status'] })
      const prev = qc.getQueryData<CaptureStatus>(['capture-status'])
      qc.setQueryData<CaptureStatus>(['capture-status'], old =>
        old ? { ...old, running: true } : old
      )
      return { prev }
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(['capture-status'], context?.prev)
    },
    onSuccess: () => {
      clear()
      qc.invalidateQueries({ queryKey: ['capture-status'] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => api.captureStop(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['capture-status'] })
      const prev = qc.getQueryData<CaptureStatus>(['capture-status'])
      qc.setQueryData<CaptureStatus>(['capture-status'], old =>
        old ? { ...old, running: false } : old
      )
      return { prev }
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(['capture-status'], context?.prev)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capture-status'] }),
  })

  const regionMutation = useMutation({
    mutationFn: (r: 'global' | 'asia') => api.captureSetRegion(r),
  })

  const snapshotsMutation = useMutation({
    mutationFn: () => api.captureOpenSnapshots(),
  })

  const running = captureStatus?.running ?? false
  const isAdmin = captureStatus?.admin ?? false
  const prereqsOk = isAdmin && (setupStatus?.mitmproxy ?? false) && (setupStatus?.certificate ?? false)

  return (
    <div className="p-6 flex gap-6 h-full">
      {/* Left: controls */}
      <div className="w-60 shrink-0 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-[#ffffff]">{t('capture.title')}</h1>

        {/* Prerequisites bar */}
        <div className="p-3 rounded-lg bg-[#181818] border border-[#282828] flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <PrereqBadge ok={isAdmin} label={t('capture.prereq.admin')} />
            <PrereqBadge ok={setupStatus?.mitmproxy ?? false} label={t('capture.prereq.mitmproxy')} />
            <PrereqBadge ok={setupStatus?.certificate ?? false} label={t('capture.prereq.certificate')} />
          </div>
          {!prereqsOk && (
            <NavLink to="/setup" className="text-xs text-[#c084fc] hover:underline mt-1">
              {t('capture.goToSetup')}
            </NavLink>
          )}
        </div>

        {/* Region selector */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#b3b3b3]">{t('capture.server')}</label>
          <select
            value={region}
            disabled={running}
            onChange={e => {
              const r = e.target.value as 'global' | 'asia'
              setRegion(r)
              regionMutation.mutate(r)
            }}
            className="bg-[#181818] border border-[#282828] rounded px-2 py-1.5 text-sm text-[#ffffff] disabled:opacity-50"
          >
            <option value="global">Global</option>
            <option value="asia">Asia</option>
          </select>
          <MutationError error={regionMutation.isError ? regionMutation.error : undefined} />
        </div>

        {/* Debug mode */}
        <label className="flex items-center gap-2 text-sm text-[#b3b3b3] cursor-pointer">
          <input
            type="checkbox"
            checked={debug}
            disabled={running}
            onChange={e => setDebug(e.target.checked)}
            className="accent-[#c084fc]"
          />
          {t('capture.debugMode')}
        </label>

        {/* Start / Stop */}
        {!running ? (
          <div className="flex flex-col gap-1">
            <Button
              onClick={() => startMutation.mutate()}
              disabled={!prereqsOk || startMutation.isPending}
              className="bg-[#c084fc] hover:bg-[#9333ea] text-white w-full"
            >
              <Radio size={14} className="mr-2" />
              {t('capture.start')}
            </Button>
            <MutationError error={startMutation.isError ? startMutation.error : undefined} />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Button
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white w-full"
            >
              <Square size={14} className="mr-2" />
              {t('capture.stop')}
            </Button>
            <MutationError error={stopMutation.isError ? stopMutation.error : undefined} />
          </div>
        )}

        {/* Secondary actions */}
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={snapshotsMutation.isPending}
            className="border-[#282828] text-[#b3b3b3] hover:text-[#ffffff] w-full justify-start"
            onClick={() => snapshotsMutation.mutate()}
          >
            <FolderOpen size={13} className="mr-2" />
            {t('capture.openSnapshots')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!captureStatus?.rescue_file}
            className="border-[#282828] text-[#b3b3b3] hover:text-[#ffffff] w-full justify-start disabled:opacity-40"
            onClick={() => {
              if (captureStatus?.rescue_file) {
                api.load(captureStatus.rescue_file)
                  .then(() => qc.invalidateQueries({ queryKey: ['fragments'] }))
              }
            }}
          >
            <Download size={13} className="mr-2" />
            {t('capture.loadLatest')}
          </Button>
        </div>
        {running && <AutoScrollPanel port={port} />}
      </div>

      {/* Right: log panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#b3b3b3]">{t('capture.log.title')}</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-[#b3b3b3] hover:text-[#ffffff]"
              onClick={() => setAutoScroll(v => !v)}
            >
              {autoScroll ? t('capture.log.pauseScroll') : t('capture.log.resumeScroll')}
            </button>
            <button type="button" className="text-xs text-[#b3b3b3] hover:text-[#ffffff]" onClick={clear}>
              {t('capture.log.clear')}
            </button>
          </div>
        </div>

        <div
          ref={logRef}
          className="flex-1 overflow-y-auto rounded-lg bg-[#0d0d0d] border border-[#282828] p-3 font-mono text-xs leading-relaxed"
        >
          {messages.length === 0 && !running && (
            <div className="text-[#404040] space-y-1">
              <p>{t('capture.log.step1')}</p>
              <p>{t('capture.log.step2')}</p>
              <p>{t('capture.log.step3')}</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={`${m.timestamp}-${i}`} style={{ color: LEVEL_COLOR[m.level] }}>
              <span className="text-[#404040]">{m.timestamp} </span>
              {m.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
