import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MemoryFragment } from '@/lib/types'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const RARITY_COLOR: Record<number, string> = {
  1: '#a8a29e',  // Common    — stone
  2: '#84cc16',  // Uncommon  — lime
  3: '#3b82f6',  // Rare      — blue
  4: '#a855f7',  // Legendary — purple
}

function GsCell({ value }: { value: number }) {
  return (
    <span className="font-mono text-[#cc785c]">{value.toFixed(1)}</span>
  )
}

function SubCell({ text }: { text: string | undefined }) {
  if (!text) return <span className="text-[#3d3d3a]">—</span>
  return <span className="text-[#a09d96] text-xs">{text}</span>
}

export function FragmentsPage() {
  const { data: fragments = [], isLoading, error } = useQuery({
    queryKey: ['fragments'],
    queryFn: () => api.fragments(),
  })

  if (isLoading) {
    return <div className="p-8 text-[#a09d96]">Loading fragments…</div>
  }

  if (error) {
    return (
      <div className="p-8 text-[#c64545]">
        Failed to load fragments. Make sure the API is running and data is loaded.
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#faf9f5]">Memory Fragments</h1>
        <Badge variant="secondary" className="bg-[#252320] text-[#a09d96]">
          {fragments.length} fragments
        </Badge>
      </div>

      <div className="rounded-md border border-[#2e2c28] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#181715] hover:bg-[#181715] border-[#2e2c28]">
              {['Slot','Set','+Lvl','Main','Sub1','Sub2','Sub3','Sub4','GS','Potential','Equipped'].map(h => (
                <TableHead key={h} className="text-[#a09d96] text-xs font-medium h-9">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fragments.map((f: MemoryFragment) => (
              <TableRow
                key={f.id}
                className="border-[#2e2c28] hover:bg-[#2e2c28] cursor-default h-7"
              >
                <TableCell className="text-[#faf9f5] py-1">{f.slot_num}</TableCell>
                <TableCell className="py-1">
                  <span style={{ color: RARITY_COLOR[f.rarity_num] }}>
                    {f.set_name}
                  </span>
                </TableCell>
                <TableCell className="text-[#faf9f5] py-1">+{f.level}</TableCell>
                <TableCell className="text-[#faf9f5] py-1 text-xs">
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
                <TableCell className="text-[#a09d96] font-mono text-xs py-1">
                  {f.potential_low.toFixed(1)}–{f.potential_high.toFixed(1)}
                </TableCell>
                <TableCell className="py-1 text-xs">
                  {f.equipped_to
                    ? <span className="text-[#faf9f5]">{f.equipped_to}</span>
                    : <span className="text-[#3d3d3a]">—</span>
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
