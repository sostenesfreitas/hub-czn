import { useState } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'

const ONBOARDING_KEY = 'home.onboarding_done'

function OnboardingView({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  function handleStart() {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    onDone()
    navigate('/setup')
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-lg">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-[#ffffff]">Hub CZN</h1>
        <p className="text-sm text-[#b3b3b3]">
          {t('home.tagline')}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs text-[#333333] uppercase tracking-wider">{t('home.howToStart')}</p>

        <div className="flex flex-col gap-2">
          <div className="p-4 rounded-lg bg-[#181818] border border-[#282828] flex items-start gap-4">
            <span className="text-[#c084fc] font-bold text-sm shrink-0 w-4">1</span>
            <div className="flex-1 min-w-0">
              <p className="text-[#ffffff] font-medium text-sm">{t('home.step1.title')}</p>
              <p className="text-[#b3b3b3] text-xs mt-0.5">
                {t('home.step1.detail')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleStart}
              className="shrink-0 text-xs px-3 py-1.5 rounded bg-[#c084fc] hover:bg-[#9333ea] text-white transition-colors"
            >
              {t('home.step1.cta')}
            </button>
          </div>

          {([
            { n: 2, titleKey: 'home.step2.title', detailKey: 'home.step2.detail' },
            { n: 3, titleKey: 'home.step3.title', detailKey: 'home.step3.detail' },
            { n: 4, titleKey: 'home.step4.title', detailKey: 'home.step4.detail' },
          ] as const).map(({ n, titleKey, detailKey }) => (
            <div
              key={n}
              className="p-4 rounded-lg bg-[#181818] border border-[#282828] flex items-start gap-4"
            >
              <span className="text-[#333333] font-bold text-sm shrink-0 w-4">{n}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[#ffffff] font-medium text-sm">{t(titleKey)}</p>
                <p className="text-[#b3b3b3] text-xs mt-0.5">{t(detailKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusCard({
  label,
  value,
  to,
  accent,
}: {
  label: string
  value: string
  to: string
  accent?: boolean
}) {
  return (
    <NavLink
      to={to}
      className="p-4 rounded-lg bg-[#181818] border border-[#282828] flex flex-col gap-2
                 hover:border-[#c084fc44] hover:bg-[#282828] transition-colors"
    >
      <p className="text-xs text-[#333333] uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-medium ${accent ? 'text-[#c084fc]' : 'text-[#ffffff]'}`}>
        {value}
      </p>
    </NavLink>
  )
}

function DashboardView({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation()

  const { data: setup, isError: setupError } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.setupStatus(),
  })
  const { data: fragments, isError: fragmentsError } = useQuery({
    queryKey: ['fragments'],
    queryFn: () => api.fragments(),
  })
  const { data: capture, isError: captureError } = useQuery({
    queryKey: ['capture-status'],
    queryFn: () => api.captureStatus(),
  })
  const { data: rescue, isError: rescueError } = useQuery({
    queryKey: ['rescue-records'],
    queryFn: () => api.rescueRecords(),
  })

  const setupComplete = setup
    ? setup.admin && setup.mitmproxy && setup.certificate
    : null

  return (
    <div className="p-6 flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-[#ffffff]">Hub CZN</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusCard
          label={t('home.status.setup')}
          value={setupError ? '—' : setupComplete == null ? '…' : setupComplete ? t('home.status.complete') : t('home.status.pending')}
          to="/setup"
          accent={setupComplete === false}
        />
        <StatusCard
          label={t('home.status.fragments')}
          value={fragmentsError ? '—' : fragments == null ? '…' : fragments.length > 0 ? t('home.status.items', { count: fragments.length }) : t('home.status.noData')}
          to="/fragments"
        />
        <StatusCard
          label={t('home.status.capture')}
          value={captureError ? '—' : capture == null ? '…' : capture.running ? t('home.status.active') : t('home.status.stopped')}
          to="/capture"
          accent={capture?.running === true}
        />
        <StatusCard
          label={t('home.status.rescue')}
          value={rescueError ? '—' : rescue == null ? '…' : rescue.length > 0 ? t('home.status.records', { count: rescue.length }) : t('home.status.noData')}
          to="/rescue"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          localStorage.removeItem(ONBOARDING_KEY)
          onReset()
        }}
        className="text-xs text-[#333333] hover:text-[#b3b3b3] transition-colors self-start"
      >
        {t('home.viewGuide')}
      </button>
    </div>
  )
}

export function HomePage() {
  const [seen, setSeen] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === 'true'
  )

  return seen
    ? <DashboardView onReset={() => setSeen(false)} />
    : <OnboardingView onDone={() => setSeen(true)} />
}
