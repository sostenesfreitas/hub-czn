import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Dialog } from 'radix-ui'
import { NavLink } from 'react-router-dom'
import { api } from '@/lib/api'
import { useApiPort } from '@/hooks/useApiPort'
import { useCaptureLog } from '@/hooks/useCaptureLog'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Radio, Square, FolderOpen, Download, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { InfoPopover } from '@/components/ui/info-popover'
import type { CaptureLogMessage, CaptureStatus } from '@/lib/types'

const LEVEL_COLOR: Record<CaptureLogMessage['level'], string> = {
  success: '#4ade80',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#b3b3b3',
}

const SKIP_MODAL_KEY = 'hub-czn:autoscroll-skip-modal'

const AUTOSCROLL_MODAL_STEPS = [
  { n: 1 as const, pre: 'capture.autoscroll.modal.step1Pre' as const, bold: 'capture.autoscroll.modal.step1Bold' as const, post: 'capture.autoscroll.modal.step1Post' as const },
  { n: 2 as const, pre: 'capture.autoscroll.modal.step2Pre' as const, bold: 'capture.autoscroll.modal.step2Bold' as const, post: 'capture.autoscroll.modal.step2Post' as const },
  { n: 3 as const, pre: 'capture.autoscroll.modal.step3Pre' as const, bold: 'capture.autoscroll.modal.step3Bold' as const, post: 'capture.autoscroll.modal.step3Post' as const },
] as const

function PrereqBadge({ ok, label, tip }: { ok: boolean; label: string; tip?: string }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${ok ? 'text-green-400' : 'text-red-400'}`}>
      {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
      {label}
      {tip && <InfoPopover content={tip} />}
    </span>
  )
}

function MutationError({ error }: { error: unknown }) {
  const { t } = useTranslation()
  if (!error) return null
  const msg = error instanceof Error ? error.message : t('common.unexpectedError')
  return <p className="text-[#f3727f] text-xs mt-1">{msg}</p>
}

function MiniPaginationPreview() {
  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-md p-3 my-3">
      <p className="text-[10px] text-[#555] mb-2">Tela do jogo — botão alvo:</p>
      <div className="flex flex-col gap-1 mb-3 opacity-50">
        {[0, 1, 2].map(row => (
          <div key={row} className="grid grid-cols-4 gap-1">
            {[0, 1, 2, 3].map(col => (
              <div
                key={col}
                className="h-2 rounded-sm"
                style={{ background: row === 1 && col === 1 ? '#3a2a5a' : '#222' }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3">
        <div className="w-6 h-6 flex items-center justify-center rounded bg-[#333] text-[#888] text-sm">‹</div>
        <span className="text-[11px] text-[#555]">1</span>
        <div className="relative">
          <div className="w-6 h-6 flex items-center justify-center rounded bg-[#c084fc] text-white text-sm font-bold ring-2 ring-[#c084fc]/40">›</div>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-[#c084fc] font-semibold">cursor aqui</span>
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm select-none">🖱️</span>
        </div>
      </div>
    </div>
  )
}

function AutoScrollConfirmModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const [skipChecked, setSkipChecked] = useState(false)

  useEffect(() => {
    if (open) setSkipChecked(false)
  }, [open])

  function handleConfirm() {
    if (skipChecked) localStorage.setItem(SKIP_MODAL_KEY, 'true')
    onConfirm()
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#282828] bg-[#111] p-5 shadow-xl focus:outline-none"
        >
          <Dialog.Title className="mb-3">
            <p className="text-[11px] text-[#666] uppercase tracking-wider mb-1">Auto-scroll de resgates</p>
            <p className="text-sm font-semibold text-white">{t('capture.autoscroll.modal.title')}</p>
          </Dialog.Title>

          <Dialog.Description className="sr-only">
            {t('capture.autoscroll.modal.step1Pre')} {t('capture.autoscroll.modal.step1Bold')} {t('capture.autoscroll.modal.step1Post')}
          </Dialog.Description>

          <div className="flex flex-col gap-2 text-xs text-[#b3b3b3]">
            {AUTOSCROLL_MODAL_STEPS.map(({ n, pre, bold, post }) => (
              <div key={n} className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded-full bg-[#c084fc] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {n}
                </div>
                <span className="leading-5">
                  {t(pre)}{' '}
                  <strong className={n === 2 ? 'text-[#c084fc]' : 'text-white'}>{t(bold)}</strong>{' '}
                  {t(post)}
                </span>
              </div>
            ))}
          </div>

          <MiniPaginationPreview />

          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={skipChecked}
              onChange={e => setSkipChecked(e.target.checked)}
              className="accent-[#c084fc]"
            />
            <span className="text-xs text-[#666]">{t('capture.autoscroll.modal.skipLabel')}</span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-1.5 text-xs text-[#b3b3b3] border border-[#282828] rounded-md hover:text-white transition-colors"
            >
              {t('capture.autoscroll.modal.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-1.5 text-xs font-semibold text-white bg-[#c084fc] rounded-md hover:bg-[#9333ea] transition-colors"
            >
              {t('capture.autoscroll.modal.confirm')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type AutoScrollPhase = 'idle' | 'countdown' | 'running' | 'done' | 'stopped'

function AutoScrollPanel({ port }: { port: number }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<AutoScrollPhase>('idle')
  const [countdown, setCountdown] = useState(5)
  const [pages, setPages] = useState(0)
  const [target, setTarget] = useState(0)
  const [records, setRecords] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [pagesTarget, setPagesTarget] = useState(10)

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
            setTarget(msg.target as number)
            setRecords(msg.records as number)
            setPhase('running')
            break
          case 'autoscroll.done':
            setPages(msg.pages as number)
            setRecords(msg.records as number)
            setPhase('done')
            import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow().setFocus()).catch(() => {})
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
      await api.autoscrollStart(pagesTarget)
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

  function handleStartClick() {
    if (localStorage.getItem(SKIP_MODAL_KEY) === 'true') {
      start()
    } else {
      setModalOpen(true)
    }
  }

  return (
    <div className="p-3 rounded-lg bg-[#181818] border border-[#282828] flex flex-col gap-2">
      <p className="text-xs text-[#666666] uppercase tracking-wider">{t('capture.autoscroll.title')}</p>

      {phase === 'idle' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#b3b3b3] shrink-0">{t('capture.autoscroll.pagesLabel')}</label>
            <input
              type="number"
              min={1}
              max={999}
              value={pagesTarget}
              onChange={e => setPagesTarget(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 bg-[#111] border border-[#282828] rounded px-2 py-1 text-xs text-white text-center"
            />
          </div>
          <button
            type="button"
            onClick={handleStartClick}
            className="bg-[#c084fc] hover:bg-[#9333ea] text-white text-xs rounded px-3 py-1.5 text-left transition-colors"
          >
            {t('capture.autoscroll.start')}
          </button>
        </div>
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
            {t('capture.autoscroll.progress', { pages, target, records })}
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

      <AutoScrollConfirmModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={() => {
          setModalOpen(false)
          start()
        }}
      />
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
  const [howToUseOpen, setHowToUseOpen] = useState(false)
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
  const prereqsOk = isAdmin && (setupStatus?.mitmproxy ?? false) && (setupStatus?.certificate_trusted ?? false)

  return (
    <div className="p-6 flex gap-6 h-full">
      {/* Left: controls */}
      <div className="w-60 shrink-0 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-[#ffffff]">{t('capture.title')}</h1>

        {/* Prerequisites bar */}
        <div className="p-3 rounded-lg bg-[#181818] border border-[#282828] flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <PrereqBadge ok={isAdmin} label={t('capture.prereq.admin')} tip={t('capture.prereq.adminTip')} />
            <PrereqBadge ok={setupStatus?.mitmproxy ?? false} label={t('capture.prereq.mitmproxy')} tip={t('capture.prereq.mitmproxyTip')} />
            <PrereqBadge ok={setupStatus?.certificate_trusted ?? false} label={t('capture.prereq.certificate')} />
          </div>
          {!prereqsOk && (
            <NavLink to="/setup" className="text-xs text-[#c084fc] hover:underline mt-1">
              {t('capture.goToSetup')}
            </NavLink>
          )}
        </div>

        {/* How to use accordion */}
        <div className="rounded-lg bg-[#181818] border border-[#282828] overflow-hidden">
          <button
            type="button"
            aria-expanded={howToUseOpen}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#b3b3b3] hover:text-[#ffffff]"
            onClick={() => setHowToUseOpen(v => !v)}
          >
            {howToUseOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {t('capture.howToUse.title')}
          </button>
          {howToUseOpen && (
            <ol className="px-4 pb-3 text-xs text-[#b3b3b3] leading-relaxed space-y-1 list-none">
              {(['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const).map(k => (
                <li key={k}>{t(`capture.howToUse.${k}`)}</li>
              ))}
            </ol>
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
              <p>{t('capture.log.step4')}</p>
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
