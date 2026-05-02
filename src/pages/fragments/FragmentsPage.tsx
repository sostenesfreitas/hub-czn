import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, assetUrl } from '@/lib/api'
import type { MemoryFragment, SetInfo } from '@/lib/types'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const RARITY_COLOR: Record<number, string> = {
  1: '#a8a29e',  // Common    — stone
  2: '#84cc16',  // Uncommon  — lime
  3: '#3b82f6',  // Rare      — blue
  4: '#c084fc',  // Legendary — purple
}

function GsCell({ value }: { value: number }) {
  return (
    <span className="font-mono text-[#c084fc]">{value.toFixed(1)}</span>
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

export function FragmentsPage() {
  const { t } = useTranslation()

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
      setMap[Number(id)] = s
    }
  }

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

  const COLS = [
    t('fragments.col.slot'),
    t('fragments.col.set'),
    t('fragments.col.level'),
    t('fragments.col.main'),
    t('fragments.col.sub1'),
    t('fragments.col.sub2'),
    t('fragments.col.sub3'),
    t('fragments.col.sub4'),
    t('fragments.col.gs'),
    t('fragments.col.potential'),
    t('fragments.col.equipped'),
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
              {COLS.map(h => (
                <TableHead key={h} className="text-[#b3b3b3] text-xs font-medium h-9">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fragments.map((f: MemoryFragment) => (
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
                  <GsCell value={f.gear_score} />
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
