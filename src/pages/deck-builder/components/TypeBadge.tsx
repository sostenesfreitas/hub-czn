import { TYPE_COLORS } from '../deck-builder.constants'

export function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? 'bg-[#222] text-[#888]'

  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cls}`}>
      {type}
    </span>
  )
}
