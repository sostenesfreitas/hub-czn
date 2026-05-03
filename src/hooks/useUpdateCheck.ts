import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface GitHubRelease {
  tag_name: string
  html_url: string
}

function isNewer(latest: string, current: string): boolean {
  const toNums = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const [la, lb, lc] = toNums(latest)
  const [ca, cb, cc] = toNums(current)
  if (la !== ca) return la > ca
  if (lb !== cb) return lb > cb
  return lc > cc
}

export function useUpdateCheck() {
  const { data: aboutData } = useQuery({
    queryKey: ['about'],
    queryFn: () => api.about(),
    staleTime: Infinity,
  })

  const { data: release, isLoading: isChecking } = useQuery<GitHubRelease>({
    queryKey: ['github-latest-release'],
    queryFn: async () => {
      const res = await fetch(
        'https://api.github.com/repos/sostenesfreitas/hub-czn/releases/latest',
      )
      if (!res.ok) throw new Error('Failed to fetch release')
      return res.json() as Promise<GitHubRelease>
    },
    enabled: aboutData != null,
    staleTime: 5 * 60 * 1_000,
    retry: 1,
  })

  const hasUpdate =
    aboutData != null &&
    release != null &&
    isNewer(release.tag_name, aboutData.version)

  return {
    currentVersion: aboutData?.version,
    latestVersion: release?.tag_name.replace(/^v/, ''),
    releaseUrl: release?.html_url,
    hasUpdate,
    isChecking,
  }
}
