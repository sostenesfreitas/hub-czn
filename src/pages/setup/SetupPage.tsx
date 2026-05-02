import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle size={18} className="text-green-500 shrink-0" />
    : <XCircle size={18} className="text-red-500 shrink-0" />
}

function MutationError({ error }: { error: unknown }) {
  const { t } = useTranslation()
  if (!error) return null
  const msg = error instanceof Error ? error.message : t('common.unexpectedError')
  return <p className="text-[#f3727f] text-xs mt-1">{msg}</p>
}

function Row({
  ok,
  label,
  detail,
  action,
  error,
}: {
  ok: boolean
  label: string
  detail: string
  action?: ReactNode
  error?: unknown
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-[#181818] border border-[#282828]">
      <StatusIcon ok={ok} />
      <div className="flex-1 min-w-0">
        <p className="text-[#ffffff] font-medium text-sm">{label}</p>
        <p className="text-[#b3b3b3] text-xs mt-0.5">{detail}</p>
        <MutationError error={error} />
      </div>
      {action}
    </div>
  )
}

export function SetupPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [howOpen, setHowOpen] = useState(false)
  const [certImported, setCertImported] = useState(
    () => localStorage.getItem('setup.cert_imported') === 'true'
  )

  const { data: status, isLoading, isError, error } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.setupStatus(),
    refetchInterval: 5000,
  })

  const installMutation = useMutation({
    mutationFn: () => api.installMitmproxy(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setup-status'] }),
  })

  const certMutation = useMutation({
    mutationFn: () => api.generateCert(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setup-status'] }),
  })

  const openCertMutation = useMutation({
    mutationFn: () => api.openCert(),
  })

  if (isLoading) {
    return <div className="p-8 text-[#b3b3b3]">{t('setup.loading')}</div>
  }

  if (isError || !status) {
    return (
      <div className="p-8 flex flex-col gap-2">
        <p className="text-[#f3727f] text-sm font-medium">{t('setup.apiError')}</p>
        <p className="text-[#b3b3b3] text-xs">
          {error instanceof Error ? error.message : t('setup.apiErrorHint')}
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4 max-w-xl">
      <h1 className="text-xl font-bold text-[#ffffff]">{t('setup.title')}</h1>

      <Row
        ok={status.admin}
        label={t('setup.admin.label')}
        detail={status.admin ? t('setup.admin.ok') : t('setup.admin.fail')}
      />

      <Row
        ok={status.mitmproxy}
        label={t('setup.mitmproxy.label')}
        detail={
          status.mitmproxy
            ? t('setup.mitmproxy.ok', { version: status.mitmproxy_version })
            : t('setup.mitmproxy.fail')
        }
        error={installMutation.isError ? installMutation.error : undefined}
        action={
          !status.mitmproxy && (
            <Button
              size="sm"
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending}
              className="bg-[#c084fc] hover:bg-[#9333ea] text-white shrink-0"
            >
              {installMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : t('setup.mitmproxy.install')}
            </Button>
          )
        }
      />

      <Row
        ok={status.certificate}
        label={t('setup.certificate.label')}
        detail={
          status.certificate
            ? t('setup.certificate.ok')
            : t('setup.certificate.fail')
        }
        error={certMutation.isError ? certMutation.error : undefined}
        action={
          !status.certificate && (
            <Button
              size="sm"
              onClick={() => certMutation.mutate()}
              disabled={certMutation.isPending}
              className="bg-[#c084fc] hover:bg-[#9333ea] text-white shrink-0"
            >
              {certMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : t('setup.certificate.generate')}
            </Button>
          )
        }
      />

      {status.certificate && (
        <div className="p-4 rounded-lg bg-[#181818] border border-[#282828] flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <StatusIcon ok={certImported} />
            <div className="flex-1">
              <p className="text-[#ffffff] font-medium text-sm">{t('setup.importCert.label')}</p>
              <p className="text-[#b3b3b3] text-xs mt-0.5">
                {t('setup.importCert.detail')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-8">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCertMutation.mutate()}
              className="border-[#282828] text-[#b3b3b3] hover:text-[#ffffff]"
            >
              {t('setup.importCert.open')}
            </Button>
            <label className="flex items-center gap-2 text-xs text-[#b3b3b3] cursor-pointer">
              <input
                type="checkbox"
                checked={certImported}
                onChange={e => {
                  setCertImported(e.target.checked)
                  localStorage.setItem('setup.cert_imported', String(e.target.checked))
                }}
                className="accent-[#c084fc]"
              />
              {t('setup.importCert.confirm')}
            </label>
          </div>
          {openCertMutation.isError && (
            <p className="text-[#f3727f] text-xs pl-8">
              {openCertMutation.error instanceof Error
                ? openCertMutation.error.message
                : t('setup.importCert.error')}
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg bg-[#181818] border border-[#282828] overflow-hidden">
        <button
          type="button"
          aria-expanded={howOpen}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#b3b3b3] hover:text-[#ffffff]"
          onClick={() => setHowOpen(v => !v)}
        >
          {howOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {t('setup.howItWorks')}
        </button>
        {howOpen && (
          <div className="px-4 pb-4 text-xs text-[#b3b3b3] leading-relaxed">
            {t('setup.howItWorksDetail')}
          </div>
        )}
      </div>
    </div>
  )
}
