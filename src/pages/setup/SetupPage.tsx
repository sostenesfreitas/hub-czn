import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle size={18} className="text-green-500 shrink-0" />
    : <XCircle size={18} className="text-red-500 shrink-0" />
}

function Row({
  ok,
  label,
  detail,
  action,
}: {
  ok: boolean
  label: string
  detail: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-[#252320] border border-[#2e2c28]">
      <StatusIcon ok={ok} />
      <div className="flex-1 min-w-0">
        <p className="text-[#faf9f5] font-medium text-sm">{label}</p>
        <p className="text-[#a09d96] text-xs mt-0.5">{detail}</p>
      </div>
      {action}
    </div>
  )
}

export function SetupPage() {
  const qc = useQueryClient()
  const [howOpen, setHowOpen] = useState(false)
  const [certImported, setCertImported] = useState(
    () => localStorage.getItem('setup.cert_imported') === 'true'
  )

  const { data: status, isLoading } = useQuery({
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

  if (isLoading || !status) {
    return <div className="p-8 text-[#a09d96]">Checking prerequisites…</div>
  }

  return (
    <div className="p-6 flex flex-col gap-4 max-w-xl">
      <h1 className="text-xl font-bold text-[#faf9f5]">Setup</h1>

      <Row
        ok={status.admin}
        label="Administrator"
        detail={
          status.admin
            ? 'Running with administrator privileges'
            : 'Close the app and reopen with "Run as administrator"'
        }
      />

      <Row
        ok={status.mitmproxy}
        label="mitmproxy"
        detail={
          status.mitmproxy
            ? `mitmproxy ${status.mitmproxy_version} installed`
            : 'Required to intercept game traffic'
        }
        action={
          !status.mitmproxy && (
            <Button
              size="sm"
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending}
              className="bg-[#cc785c] hover:bg-[#b8674d] text-white shrink-0"
            >
              {installMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Instalar'}
            </Button>
          )
        }
      />

      <Row
        ok={status.certificate}
        label="Certificado CA"
        detail={
          status.certificate
            ? 'Certificate generated in ~/.mitmproxy/'
            : 'Required for HTTPS interception'
        }
        action={
          !status.certificate && (
            <Button
              size="sm"
              onClick={() => certMutation.mutate()}
              disabled={certMutation.isPending}
              className="bg-[#cc785c] hover:bg-[#b8674d] text-white shrink-0"
            >
              {certMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Gerar'}
            </Button>
          )
        }
      />

      {status.certificate && (
        <div className="p-4 rounded-lg bg-[#252320] border border-[#2e2c28] flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <StatusIcon ok={certImported} />
            <div className="flex-1">
              <p className="text-[#faf9f5] font-medium text-sm">Importar certificado no Windows</p>
              <p className="text-[#a09d96] text-xs mt-0.5">
                Abra o certificado → "Instalar Certificado" → "Máquina Local" →
                "Autoridades de Certificação Raiz Confiáveis"
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-8">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCertMutation.mutate()}
              className="border-[#2e2c28] text-[#a09d96] hover:text-[#faf9f5]"
            >
              Abrir certificado
            </Button>
            <label className="flex items-center gap-2 text-xs text-[#a09d96] cursor-pointer">
              <input
                type="checkbox"
                checked={certImported}
                onChange={e => {
                  setCertImported(e.target.checked)
                  localStorage.setItem('setup.cert_imported', String(e.target.checked))
                }}
                className="accent-[#cc785c]"
              />
              Já importei o certificado
            </label>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-[#252320] border border-[#2e2c28] overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#a09d96] hover:text-[#faf9f5]"
          onClick={() => setHowOpen(v => !v)}
        >
          {howOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Como funciona?
        </button>
        {howOpen && (
          <div className="px-4 pb-4 text-xs text-[#a09d96] leading-relaxed">
            O app usa mitmproxy como proxy reverso local. Ao iniciar o capture, ele redireciona o
            tráfego do jogo para o proxy via arquivo hosts do Windows. O proxy intercepta as
            mensagens WebSocket do servidor e extrai os dados de inventário e rescue em tempo real.
            Nenhum dado é enviado para fora — tudo fica local.
          </div>
        )}
      </div>
    </div>
  )
}
