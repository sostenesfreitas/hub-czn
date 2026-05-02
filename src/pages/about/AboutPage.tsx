import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, GitFork, Bug, BookOpen, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'

async function openUrl(url: string) {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function LinkRow({ icon, label, url }: { icon: ReactNode; label: string; url: string }) {
  return (
    <button
      type="button"
      onClick={() => openUrl(url)}
      className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#252320] border border-[#2e2c28]
                 text-left hover:border-[#cc785c44] hover:bg-[#2e2c28] transition-colors group"
    >
      <span className="text-[#a09d96] group-hover:text-[#cc785c] transition-colors shrink-0">
        {icon}
      </span>
      <span className="text-sm text-[#a09d96] group-hover:text-[#faf9f5] transition-colors flex-1">
        {label}
      </span>
      <ExternalLink size={12} className="text-[#3a3835] group-hover:text-[#a09d96] transition-colors shrink-0" />
    </button>
  )
}

export function AboutPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['about'],
    queryFn: () => api.about(),
    staleTime: Infinity,
  })

  return (
    <div className="p-6 flex flex-col gap-6 max-w-md">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-[#faf9f5]">Sobre</h1>
      </div>

      {/* App info */}
      <div className="p-4 rounded-lg bg-[#252320] border border-[#2e2c28] flex flex-col gap-2">
        <p className="text-lg font-semibold text-[#faf9f5]">Hub CZN</p>
        <p className="text-sm text-[#a09d96]">
          A Fribbels-inspired gear management and optimization tool
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[#3a3835]">Versão</span>
          {isLoading ? (
            <span className="text-xs text-[#3a3835]">…</span>
          ) : (
            <span className="text-xs font-mono text-[#cc785c]">{data?.version ?? '—'}</span>
          )}
        </div>
      </div>

      {/* Check for updates */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[#3a3835] uppercase tracking-wider px-1">Atualizações</p>
        <button
          type="button"
          onClick={() => data && openUrl(data.releases_url)}
          disabled={!data}
          className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#252320] border border-[#2e2c28]
                     text-left hover:border-[#cc785c44] hover:bg-[#2e2c28] transition-colors group
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw
            size={16}
            className="text-[#a09d96] group-hover:text-[#cc785c] transition-colors shrink-0"
          />
          <span className="text-sm text-[#a09d96] group-hover:text-[#faf9f5] transition-colors flex-1">
            Ver releases no GitHub
          </span>
          <ExternalLink
            size={12}
            className="text-[#3a3835] group-hover:text-[#a09d96] transition-colors shrink-0"
          />
        </button>
      </div>

      {/* Links */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[#3a3835] uppercase tracking-wider px-1">Links</p>
        <div className="flex flex-col gap-2">
          <LinkRow
            icon={<GitFork size={16} />}
            label="Repositório no GitHub"
            url={data?.github_url ?? 'https://github.com/sostenesfreitas/hub-czn'}
          />
          <LinkRow
            icon={<Bug size={16} />}
            label="Reportar um problema"
            url={data?.issues_url ?? 'https://github.com/sostenesfreitas/hub-czn/issues'}
          />
          <LinkRow
            icon={<BookOpen size={16} />}
            label="Documentação (README)"
            url={`${data?.github_url ?? 'https://github.com/sostenesfreitas/hub-czn'}#readme`}
          />
        </div>
      </div>
    </div>
  )
}
