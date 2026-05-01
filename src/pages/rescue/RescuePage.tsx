// src/pages/rescue/RescuePage.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api'
import type { RescueBanner, RescuePull } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'

const PIE_COLORS = ['#cc785c', '#8b5cf6', '#a09d96']
const RARITY_FILTER = [0, 5, 4] as const

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[#a09d96]">{label}</span>
      <span className="text-[#cc785c] font-medium">{value}</span>
    </div>
  )
}

function PortraitGrid({ pulls }: { pulls: RescuePull[] }) {
  const fiveStars = pulls.filter(p => p.rarity >= 5)
  if (fiveStars.length === 0) return null
  return (
    <div>
      <p className="text-sm font-medium text-[#faf9f5] mb-3">Saltos 5★ Recentes</p>
      <div className="flex flex-wrap gap-2">
        {fiveStars.map((p, i) => (
          <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#252320] border border-[#2e2c28]">
            <img
              src={p.image_url}
              alt={p.name}
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className="absolute bottom-0 left-0 bg-black/70 text-[10px] text-[#faf9f5] px-1 py-0.5 font-mono">
              {p.pity}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BannerView({ banner }: { banner: RescueBanner }) {
  const [rarityFilter, setRarityFilter] = useState<0 | 5 | 4>(0)
  const [page, setPage] = useState(0)
  const PER_PAGE = 50

  const { stats, pulls } = banner

  const pieData = [
    { name: '5★', value: stats.five_star },
    { name: '4★', value: stats.four_star },
    { name: '3★', value: stats.total - stats.five_star - stats.four_star },
  ]

  const filtered = rarityFilter === 0 ? pulls : pulls.filter(p => p.rarity === rarityFilter)
  const pages = Math.ceil(filtered.length / PER_PAGE)
  const pageSlice = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  return (
    <div className="flex flex-col gap-6">
      {/* Stats + Pie */}
      <div className="flex gap-6 p-4 rounded-lg bg-[#252320] border border-[#2e2c28]">
        <div className="flex-1 flex flex-col gap-2 justify-center">
          <StatRow label="Total de Saltos" value={stats.total.toLocaleString()} />
          <StatRow label="Recursos Gastos (Jades)" value={stats.resources_spent.toLocaleString()} />
          <StatRow label="Saltos 5★" value={stats.five_star} />
          <StatRow label="Saltos 4★" value={stats.four_star} />
          <StatRow label="Pity 5★ Médio" value={stats.avg_pity_5} />
          <StatRow label="Pity 4★ Médio" value={stats.avg_pity_4} />
          <StatRow label="50/50 Win Rate" value={`${(stats.win_rate_50_50 * 100).toFixed(2)}%`} />
        </div>
        <div className="w-40 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={60} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#252320', border: '1px solid #2e2c28', borderRadius: 6 }}
                labelStyle={{ color: '#faf9f5' }}
                itemStyle={{ color: '#a09d96' }}
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
          <p className="text-sm font-medium text-[#faf9f5]">Histórico Completo</p>
          <div className="flex gap-1">
            {RARITY_FILTER.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => { setRarityFilter(r); setPage(0) }}
                className={`px-2 py-1 text-xs rounded ${
                  rarityFilter === r
                    ? 'bg-[#cc785c] text-white'
                    : 'bg-[#252320] text-[#a09d96] hover:text-[#faf9f5]'
                }`}
              >
                {r === 0 ? 'Todos' : `${r}★`}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[#2e2c28] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#252320] hover:bg-[#252320] border-[#2e2c28]">
                {['Nº Roll', 'Personagem', 'Pity', 'Banner', 'Hora'].map(h => (
                  <TableHead key={h} className="text-[#a09d96] text-xs h-9">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageSlice.map((pull, i) => (
                <TableRow key={i} className="border-[#2e2c28] hover:bg-[#252320]">
                  <TableCell className="text-[#a09d96] font-mono text-xs">{pull.pull_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <img
                        src={pull.image_url}
                        alt={pull.name}
                        className="w-6 h-6 rounded object-cover bg-[#252320]"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <span className={`text-sm ${pull.rarity >= 5 ? 'text-[#cc785c]' : pull.rarity >= 4 ? 'text-purple-400' : 'text-[#faf9f5]'}`}>
                        {pull.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-[#2e2c28] text-[#a09d96]">
                        {pull.kind}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-[#faf9f5]">{pull.pity}</TableCell>
                  <TableCell className="text-xs text-[#a09d96]">{banner.banner_name}</TableCell>
                  <TableCell className="text-xs text-[#a09d96]">
                    {pull.timestamp ? new Date(pull.timestamp * 1000).toLocaleString('pt-BR') : '—'}
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
              className="text-xs text-[#a09d96] hover:text-[#faf9f5] disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="text-xs text-[#a09d96]">{page + 1} / {pages}</span>
            <button
              type="button"
              disabled={page === pages - 1}
              onClick={() => setPage(p => p + 1)}
              className="text-xs text-[#a09d96] hover:text-[#faf9f5] disabled:opacity-30"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function RescuePage() {
  const [activeTab, setActiveTab] = useState(0)

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['rescue-records'],
    queryFn: () => api.rescueRecords(),
    refetchInterval: 10000,
  })

  if (isLoading) return <div className="p-8 text-[#a09d96]">Carregando…</div>

  if (banners.length === 0) {
    return (
      <div className="p-8 text-[#a09d96]">
        <p className="text-lg text-[#faf9f5] mb-2">Rescue Records</p>
        <p className="text-sm">Nenhum registro capturado ainda.</p>
        <p className="text-sm mt-1">Inicie o capture e navegue até Rescue Records no jogo.</p>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4 overflow-y-auto h-full">
      <h1 className="text-xl font-bold text-[#faf9f5]">Rescue Records</h1>

      {/* Banner tabs */}
      <div className="flex gap-1 border-b border-[#2e2c28] pb-0">
        {banners.map((b, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              activeTab === i
                ? 'border-[#cc785c] text-[#cc785c]'
                : 'border-transparent text-[#a09d96] hover:text-[#faf9f5]'
            }`}
          >
            {b.banner_name}
          </button>
        ))}
      </div>

      <BannerView banner={banners[activeTab]} />
    </div>
  )
}
