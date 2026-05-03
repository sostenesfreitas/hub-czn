import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { User, RefreshCw, Download } from 'lucide-react'
import { api } from '@/lib/api'
import i18n from '@/i18n'
import type { RescueBanner, RescuePull } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'

const PIE_COLORS = ['#c084fc', '#8b5cf6', '#b3b3b3']
const RARITY_FILTER = [0, 5, 4] as const
const PER_PAGE = 50

const PIE_TOOLTIP_CONTENT_STYLE = { background: '#181818', border: '1px solid #282828', borderRadius: 6 }
const PIE_TOOLTIP_LABEL_STYLE = { color: '#ffffff' }
const PIE_TOOLTIP_ITEM_STYLE = { color: '#b3b3b3' }

type RarityFilterValue = typeof RARITY_FILTER[number]

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[#b3b3b3]">{label}</span>
      <span className="text-[#c084fc] font-medium">{value}</span>
    </div>
  )
}

function PortraitCard({ pull }: { pull: RescuePull }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#181818] border border-[#282828]">
      {imgError ? (
        <div className="w-full h-full flex items-center justify-center text-[#b3b3b3]">
          <User size={24} />
        </div>
      ) : (
        <img
          src={pull.image_url}
          alt={pull.name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      )}
      <span className="absolute bottom-0 left-0 bg-black/70 text-[10px] text-[#ffffff] px-1 py-0.5 font-mono">
        {pull.pity}
      </span>
    </div>
  )
}

function TableCellImage({ pull }: { pull: RescuePull }) {
  const [imgError, setImgError] = useState(false)
  if (imgError) return <User size={16} className="text-[#b3b3b3]" />
  return (
    <img
      src={pull.image_url}
      alt={pull.name}
      className="w-6 h-6 rounded object-cover bg-[#181818]"
      onError={() => setImgError(true)}
    />
  )
}

function PortraitGrid({ pulls }: { pulls: RescuePull[] }) {
  const { t } = useTranslation()
  const fiveStars = pulls.filter(p => p.rarity >= 5)
  if (fiveStars.length === 0) return null
  return (
    <div>
      <p className="text-sm font-medium text-[#ffffff] mb-3">{t('rescue.fiveStarRecent')}</p>
      <div className="flex flex-wrap gap-2">
        {fiveStars.map(p => (
          <PortraitCard key={p.res_id} pull={p} />
        ))}
      </div>
    </div>
  )
}

function BannerView({ banner }: { banner: RescueBanner }) {
  const { t } = useTranslation()
  const [rarityFilter, setRarityFilter] = useState<RarityFilterValue>(0)
  const [page, setPage] = useState(0)

  const { stats, pulls } = banner

  const pieData = useMemo(() => [
    { name: '5★', value: stats.five_star },
    { name: '4★', value: stats.four_star },
    { name: '3★', value: stats.total - stats.five_star - stats.four_star },
  ], [stats])

  const filtered = rarityFilter === 0 ? pulls : pulls.filter(p => p.rarity === rarityFilter)
  const pages = Math.ceil(filtered.length / PER_PAGE)
  const pageSlice = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  return (
    <div className="flex flex-col gap-6">
      {/* Stats + Pie */}
      <div className="flex gap-6 p-4 rounded-lg bg-[#181818] border border-[#282828]">
        <div className="flex-1 flex flex-col gap-2 justify-center">
          <StatRow label={t('rescue.stats.total')} value={stats.total.toLocaleString()} />
          <StatRow label={t('rescue.stats.resources')} value={stats.resources_spent.toLocaleString()} />
          <StatRow label={t('rescue.stats.fiveStar')} value={stats.five_star} />
          <StatRow label={t('rescue.stats.fourStar')} value={stats.four_star} />
          <StatRow label={t('rescue.stats.avgPity5')} value={stats.avg_pity_5} />
          <StatRow label={t('rescue.stats.avgPity4')} value={stats.avg_pity_4} />
          <StatRow label={t('rescue.stats.winRate')} value={`${(stats.win_rate_50_50 * 100).toFixed(2)}%`} />
        </div>
        <div className="w-40 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={60} dataKey="value">
                {pieData.map((entry, i) => <Cell key={entry.name} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip
                contentStyle={PIE_TOOLTIP_CONTENT_STYLE}
                labelStyle={PIE_TOOLTIP_LABEL_STYLE}
                itemStyle={PIE_TOOLTIP_ITEM_STYLE}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5★ Portrait Grid */}
      <PortraitGrid pulls={pulls} />

      {/* Pull History Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[#ffffff]">{t('rescue.fullHistory')}</p>
          <div className="flex gap-1">
            {RARITY_FILTER.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => { setRarityFilter(r); setPage(0) }}
                className={`px-2 py-1 text-xs rounded ${
                  rarityFilter === r
                    ? 'bg-[#c084fc] text-white'
                    : 'bg-[#181818] text-[#b3b3b3] hover:text-[#ffffff]'
                }`}
              >
                {r === 0 ? t('rescue.filter.all') : `${r}★`}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#282828] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#181818] hover:bg-[#181818] border-[#282828]">
                {[
                  t('rescue.table.roll'),
                  t('rescue.table.character'),
                  t('rescue.table.pity'),
                  t('rescue.table.banner'),
                  t('rescue.table.time'),
                ].map(h => (
                  <TableHead key={h} className="text-[#b3b3b3] text-xs h-9">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageSlice.map(pull => (
                <TableRow key={pull.pull_number} className="border-[#282828] hover:bg-[#181818]">
                  <TableCell className="text-[#b3b3b3] font-mono text-xs">{pull.pull_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TableCellImage pull={pull} />
                      <span className={`text-sm ${pull.rarity >= 5 ? 'text-[#c084fc]' : pull.rarity >= 4 ? 'text-purple-400' : 'text-[#ffffff]'}`}>
                        {pull.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-[#282828] text-[#b3b3b3]">
                        {pull.kind}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-[#ffffff]">{pull.pity}</TableCell>
                  <TableCell className="text-xs text-[#b3b3b3]">{banner.banner_name}</TableCell>
                  <TableCell className="text-xs text-[#b3b3b3]">
                    {pull.timestamp !== 0 ? new Date(pull.timestamp * 1000).toLocaleString(i18n.language) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {pages > 1 && (
          <div className="flex gap-2 mt-3 justify-end">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="text-xs text-[#b3b3b3] hover:text-[#ffffff] disabled:opacity-30"
            >
              {t('rescue.pagination.prev')}
            </button>
            <span className="text-xs text-[#b3b3b3]">{page + 1} / {pages}</span>
            <button
              type="button"
              disabled={page === pages - 1}
              onClick={() => setPage(p => p + 1)}
              className="text-xs text-[#b3b3b3] hover:text-[#ffffff] disabled:opacity-30"
            >
              {t('rescue.pagination.next')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function exportRescue(banners: RescueBanner[]) {
  const blob = new Blob([JSON.stringify(banners, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'rescue_records.json'
  a.click()
  URL.revokeObjectURL(url)
}

export function RescuePage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState(0)
  const qc = useQueryClient()

  const { data: captureStatus } = useQuery({
    queryKey: ['capture-status'],
    queryFn: () => api.captureStatus(),
    refetchInterval: 3000,
  })

  const capturing = captureStatus?.running ?? false

  const { data: banners = [], isLoading, error } = useQuery({
    queryKey: ['rescue-records'],
    queryFn: () => api.rescueRecords(),
    refetchInterval: capturing ? 10000 : false,
  })

  if (isLoading) return <div className="p-8 text-[#b3b3b3]">{t('rescue.loading')}</div>

  if (error) {
    return (
      <div className="p-8 text-[#f3727f]">
        {t('rescue.loadError')}
      </div>
    )
  }

  if (banners.length === 0) {
    return (
      <div className="p-8 text-[#b3b3b3]">
        <p className="text-lg text-[#ffffff] mb-2">{t('rescue.title')}</p>
        <p className="text-sm">{t('rescue.empty')}</p>
      </div>
    )
  }

  const safeBanner = banners[activeTab] ?? banners[0]

  return (
    <div className="p-6 flex flex-col gap-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#ffffff]">{t('rescue.title')}</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-[#282828] text-[#b3b3b3] hover:text-[#ffffff]"
            onClick={() => exportRescue(banners)}
          >
            <Download size={13} className="mr-1" />
            {t('rescue.exportJson')}
          </Button>
          {!capturing && (
            <Button
              size="sm"
              variant="outline"
              className="border-[#282828] text-[#b3b3b3] hover:text-[#ffffff]"
              onClick={() => qc.invalidateQueries({ queryKey: ['rescue-records'] })}
            >
              <RefreshCw size={13} className="mr-1" />
              {t('rescue.refresh')}
            </Button>
          )}
        </div>
      </div>

      {/* Banner tabs */}
      <div className="flex gap-1 border-b border-[#282828] pb-0">
        {banners.map((b, i) => (
          <button
            key={b.banner_name}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              activeTab === i
                ? 'border-[#c084fc] text-[#c084fc]'
                : 'border-transparent text-[#b3b3b3] hover:text-[#ffffff]'
            }`}
          >
            {b.banner_name}
          </button>
        ))}
      </div>

      <BannerView banner={safeBanner} />
    </div>
  )
}
