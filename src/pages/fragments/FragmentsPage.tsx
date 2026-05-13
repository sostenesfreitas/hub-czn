import { useState } from 'react'
import type React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, assetUrl } from '@/lib/api'
import type { MemoryFragment, SetInfo } from '@/lib/types'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { InfoPopover } from '@/components/ui/info-popover'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

const RARITY_COLOR: Record<number, string> = {
  1: '#a8a29e',
  2: '#84cc16',
  3: '#3b82f6',
  4: '#c084fc',
}

function GsCell({ gearScore, priorityScore }: { gearScore: number; priorityScore: number }) {
  const score = priorityScore > 0 ? priorityScore : gearScore
  return (
    <span className="font-mono text-[#c084fc]">{score.toFixed(1)}</span>
  )
}

function SubCell({ text }: { text: string | undefined }) {
  if (!text) return <span className="text-[#404040]">—</span>
  return <span className="text-[#b3b3b3] text-xs">{text}</span>
}

function PieceThumb({ setId, slotNum }: { setId: number; slotNum: number }) {
  const src = assetUrl(`/assets/game/pieces/item_piece_set_${String(setId).padStart(3, '0')}_${slotNum}.png`)
  return (
    <img
      src={src}
      alt=""
      className="w-8 h-8 object-contain shrink-0"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }}
    />
  )
}

type SortDir = 'asc' | 'desc'

function getSortValue(f: MemoryFragment, key: string): string | number {
  switch (key) {
    case 'slot':      return f.slot_num
    case 'set':       return f.set_name
    case 'level':     return f.level
    case 'main':      return f.main_stat?.formatted ?? ''
    case 'sub1':      return f.substats[0]?.formatted ?? ''
    case 'sub2':      return f.substats[1]?.formatted ?? ''
    case 'sub3':      return f.substats[2]?.formatted ?? ''
    case 'sub4':      return f.substats[3]?.formatted ?? ''
    case 'gs':        return f.priority_score > 0 ? f.priority_score : f.gear_score
    case 'potential': return f.potential_low
    case 'equipped':  return f.equipped_to ?? ''
    default:          return ''
  }
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={12} className="text-[#404040]" />
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-[#c084fc]" />
    : <ChevronDown size={12} className="text-[#c084fc]" />
}

export function FragmentsPage() {
  const { t } = useTranslation()
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data: fragments = [], isLoading, error } = useQuery({
    queryKey: ['fragments'],
    queryFn: () => api.fragments(),
  })

  const { data: gameData } = useQuery({
    queryKey: ['game-data'],
    queryFn: () => api.gameData(),
    staleTime: Infinity,
  })

  const setMap: Record<number, SetInfo> = {}
  if (gameData?.sets) {
    for (const [id, s] of Object.entries(gameData.sets)) {
      setMap[Number(id)] = s as SetInfo
    }
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortKey
    ? [...fragments].sort((a, b) => {
        const av = getSortValue(a, sortKey)
        const bv = getSortValue(b, sortKey)
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av
        }
        return sortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av))
      })
    : fragments

  if (isLoading) {
    return <div className="p-8 text-[#b3b3b3]">{t('fragments.loading')}</div>
  }

  if (error) {
    return (
      <div className="p-8 text-[#f3727f]">
        {t('fragments.loadError')}
      </div>
    )
  }

  const COLS: { key: string; label: string; info?: React.ReactNode }[] = [
    { key: 'slot',      label: t('fragments.col.slot') },
    { key: 'set',       label: t('fragments.col.set') },
    { key: 'level',     label: t('fragments.col.level') },
    { key: 'main',      label: t('fragments.col.main') },
    { key: 'sub1',      label: t('fragments.col.sub1') },
    { key: 'sub2',      label: t('fragments.col.sub2') },
    { key: 'sub3',      label: t('fragments.col.sub3') },
    { key: 'sub4',      label: t('fragments.col.sub4') },
    { key: 'gs',        label: t('fragments.col.gs'),        info: <InfoPopover content={t('tips.gs')} /> },
    { key: 'potential', label: t('fragments.col.potential'), info: <InfoPopover content={t('tips.potential')} /> },
    { key: 'equipped',  label: t('fragments.col.equipped') },
  ]

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#ffffff]">{t('fragments.title')}</h1>
        <Badge variant="secondary" className="bg-[#181818] text-[#b3b3b3]">
          {t('fragments.count', { count: fragments.length })}
        </Badge>
      </div>

      <div className="rounded-md border border-[#282828] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#121212] hover:bg-[#121212] border-[#282828]">
              {COLS.map(col => (
                <TableHead key={col.key} className="text-[#b3b3b3] text-xs font-medium h-9 px-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1 hover:text-[#ffffff] transition-colors"
                    >
                      {col.label}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </button>
                    {col.info}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((f: MemoryFragment) => (
              <TableRow
                key={f.id}
                className="border-[#282828] hover:bg-[#282828] cursor-default h-7"
              >
                <TableCell className="text-[#666666] text-xs tabular-nums py-1">{f.slot_num}</TableCell>
                <TableCell className="py-1">
                  <span className="flex items-center gap-1.5" style={{ color: RARITY_COLOR[f.rarity_num] }}>
                    <PieceThumb setId={f.set_id} slotNum={f.slot_num} />
                    {f.set_name}
                  </span>
                </TableCell>
                <TableCell className="text-[#ffffff] py-1">+{f.level}</TableCell>
                <TableCell className="text-[#ffffff] py-1 text-xs">
                  {f.main_stat?.formatted ?? '—'}
                </TableCell>
                {[0, 1, 2, 3].map(i => (
                  <TableCell key={i} className="py-1">
                    <SubCell text={f.substats[i]?.formatted} />
                  </TableCell>
                ))}
                <TableCell className="py-1">
                  <GsCell gearScore={f.gear_score} priorityScore={f.priority_score} />
                </TableCell>
                <TableCell className="text-[#b3b3b3] font-mono text-xs py-1">
                  {f.potential_low.toFixed(1)}–{f.potential_high.toFixed(1)}
                </TableCell>
                <TableCell className="py-1 text-xs">
                  {f.equipped_to
                    ? <span className="text-[#ffffff]">{f.equipped_to}</span>
                    : <span className="text-[#404040]">—</span>
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
