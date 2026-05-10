import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openExternal } from '@/lib/browser'

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

  const { data: status, isLoading, isError, error } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.setupStatus(),
    refetchInterval: 5000,
  })

  const certMutation = useMutation({
    mutationFn: () => api.generateCert(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setup-status'] }),
  })

  const openCertMutation = useMutation({
    mutationFn: () => api.openCert(),
  })

  const installCertMutation = useMutation({
    mutationFn: () => api.installCertificate(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setup-status'] }),
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
        ok={status.can_write_hosts}
        label={t('setup.hosts.label')}
        detail={
          status.can_write_hosts
            ? t('setup.hosts.ok')
            : status.hosts_block_reason ?? t('setup.hosts.fail')
        }
      />

      <Row
        ok={status.mitmproxy}
        label={t('setup.mitmproxy.label')}
        detail={
          status.mitmproxy
            ? t('setup.mitmproxy.ok', { version: status.mitmproxy_version })
            : t('setup.mitmproxy.fail')
        }
        action={
          !status.mitmproxy && (
            <Button
              size="sm"
              onClick={() => openExternal('https://apps.microsoft.com/detail/9nwndlqmnzd7?hl=en-US&gl=US')}
              className="bg-[#c084fc] hover:bg-[#9333ea] text-white shrink-0"
            >
              {t('setup.mitmproxy.install')}
            </Button>
          )
        }
      />

      <Row
        ok={status.certificate_trusted}
        label={t('setup.certificate.label')}
        detail={
          status.certificate_trusted
            ? t('setup.certificate.trustedOk')
            : status.certificate
              ? t('setup.certificate.trustedFail')
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

      {status.certificate && !status.certificate_trusted && (
        <div className="p-4 rounded-lg bg-[#181818] border border-[#282828] flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <StatusIcon ok={false} />
            <div className="flex-1">
              <p className="text-[#ffffff] font-medium text-sm">{t('setup.installCert.label')}</p>
              <p className="text-[#b3b3b3] text-xs mt-0.5">{t('setup.installCert.detail')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 pl-8">
            <Button
              size="sm"
              onClick={() => installCertMutation.mutate()}
              disabled={installCertMutation.isPending}
              className="bg-[#c084fc] hover:bg-[#9333ea] text-white self-start"
            >
              {installCertMutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  {t('setup.installCert.installing')}
                </>
              ) : (
                t('setup.installCert.button')
              )}
            </Button>
            {installCertMutation.isError && (
              <p className="text-[#f3727f] text-xs">
                {installCertMutation.error instanceof Error
                  ? installCertMutation.error.message
                  : t('setup.installCert.error')}
              </p>
            )}
            {installCertMutation.data && installCertMutation.data.ok === false && (
              <p className="text-[#f3727f] text-xs">
                {installCertMutation.data.error ?? t('setup.installCert.error')}
              </p>
            )}
            <button
              type="button"
              onClick={() => openCertMutation.mutate()}
              className="text-xs text-[#b3b3b3] hover:text-[#ffffff] underline self-start"
            >
              {t('setup.installCert.manualLink')}
            </button>
            <p className="text-xs text-[#666666]">{t('setup.installCert.manualHint')}</p>
            {openCertMutation.isError && (
              <p className="text-[#f3727f] text-xs">
                {openCertMutation.error instanceof Error
                  ? openCertMutation.error.message
                  : t('setup.installCert.openError')}
              </p>
            )}
          </div>
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
