import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ExternalLink, GitFork, Bug, BookOpen, Download, CheckCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useUpdateCheck } from '@/hooks/useUpdateCheck'

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
      className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#181818] border border-[#282828]
                 text-left hover:border-[#c084fc44] hover:bg-[#282828] transition-colors group"
    >
      <span className="text-[#b3b3b3] group-hover:text-[#c084fc] transition-colors shrink-0">
        {icon}
      </span>
      <span className="text-sm text-[#b3b3b3] group-hover:text-[#ffffff] transition-colors flex-1">
        {label}
      </span>
      <ExternalLink size={12} className="text-[#333333] group-hover:text-[#b3b3b3] transition-colors shrink-0" />
    </button>
  )
}

export function AboutPage() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['about'],
    queryFn: () => api.about(),
    staleTime: Infinity,
  })

  const { hasUpdate, latestVersion, releaseUrl, isChecking } = useUpdateCheck()

  return (
    <div className="p-6 flex flex-col gap-6 max-w-md">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-[#ffffff]">{t('about.title')}</h1>
      </div>

      {/* App info */}
      <div className="p-4 rounded-lg bg-[#181818] border border-[#282828] flex flex-col gap-2">
        <p className="text-lg font-semibold text-[#ffffff]">Hub CZN</p>
        <p className="text-sm text-[#b3b3b3]">
          {t('about.tagline')}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[#333333]">{t('about.version')}</span>
          {isLoading ? (
            <span className="text-xs text-[#333333]">…</span>
          ) : (
            <span className="text-xs font-mono text-[#c084fc]">{data?.version ?? '—'}</span>
          )}
        </div>
      </div>

      {/* Check for updates */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[#333333] uppercase tracking-wider px-1">{t('about.updates')}</p>
        {isChecking ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#181818] border border-[#282828]">
            <Loader2 size={16} className="text-[#b3b3b3] animate-spin shrink-0" />
            <span className="text-sm text-[#b3b3b3]">{t('about.checking')}</span>
          </div>
        ) : hasUpdate ? (
          <button
            type="button"
            onClick={() => releaseUrl && openUrl(releaseUrl)}
            className="flex items-center gap-3 w-full p-3 rounded-lg bg-[#c084fc]/10 border border-[#c084fc]/40
                       text-left hover:bg-[#c084fc]/20 transition-colors group"
          >
            <Download size={16} className="text-[#c084fc] shrink-0" />
            <span className="text-sm text-[#ffffff] flex-1">
              {t('about.updateAvailable', { version: latestVersion })}
            </span>
            <ExternalLink size={12} className="text-[#c084fc] shrink-0" />
          </button>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#181818] border border-[#282828]">
            <CheckCircle size={16} className="text-[#4ade80] shrink-0" />
            <span className="text-sm text-[#b3b3b3]">{t('about.upToDate')}</span>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[#333333] uppercase tracking-wider px-1">{t('about.links')}</p>
        <div className="flex flex-col gap-2">
          <LinkRow
            icon={<GitFork size={16} />}
            label={t('about.github')}
            url={data?.github_url ?? 'https://github.com/sostenesfreitas/hub-czn'}
          />
          <LinkRow
            icon={<Bug size={16} />}
            label={t('about.report')}
            url={data?.issues_url ?? 'https://github.com/sostenesfreitas/hub-czn/issues'}
          />
          <LinkRow
            icon={<BookOpen size={16} />}
            label={t('about.docs')}
            url={`${data?.github_url ?? 'https://github.com/sostenesfreitas/hub-czn'}#readme`}
          />
        </div>
      </div>
    </div>
  )
}
