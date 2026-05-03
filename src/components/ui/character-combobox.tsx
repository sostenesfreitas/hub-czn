import { useState, useRef, useEffect } from 'react'
import { ChevronDown, User } from 'lucide-react'
import { assetUrl } from '@/lib/api'
import type { Combatant } from '@/lib/types'

interface CharacterComboboxProps {
  combatants: Combatant[]
  value: string
  onChange: (charId: string) => void
  disabled?: boolean
  placeholder?: string
}

function CharAvatar({ combatant }: { combatant: Combatant }) {
  const [error, setError] = useState(false)
  if (!combatant.portrait_url || error) {
    return (
      <div className="w-6 h-6 rounded-full bg-[#282828] flex items-center justify-center shrink-0">
        <User size={12} className="text-[#555]" />
      </div>
    )
  }
  return (
    <img
      src={assetUrl(combatant.portrait_url)}
      alt={combatant.name}
      className="w-6 h-6 rounded-full object-cover shrink-0"
      onError={() => setError(true)}
    />
  )
}

export function CharacterCombobox({
  combatants,
  value,
  onChange,
  disabled,
  placeholder = 'Selecionar...',
}: CharacterComboboxProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFilter('')
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  const selected = combatants.find((c) => c.char_id === value)
  const filtered = filter
    ? combatants.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
    : combatants

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((o) => !o)
            setFilter('')
          }
        }}
        className="w-full bg-[#282828] border border-[#333333] rounded px-2.5 py-1.5 text-xs text-left flex items-center gap-2 outline-none focus:border-[#c084fc] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selected ? (
          <>
            <CharAvatar combatant={selected} />
            <span className="flex-1 truncate text-[#ffffff]">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-[#666666]">{placeholder}</span>
        )}
        <ChevronDown size={12} className="text-[#666] shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e1e] border border-[#333] rounded z-50 overflow-hidden shadow-xl">
          <div className="p-1.5 border-b border-[#282828]">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-transparent text-xs text-[#b3b3b3] outline-none placeholder:text-[#444]"
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.map((c) => (
              <button
                key={c.char_id}
                type="button"
                onClick={() => {
                  onChange(c.char_id)
                  setOpen(false)
                  setFilter('')
                }}
                className={[
                  'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-[#282828]',
                  c.char_id === value ? 'bg-[#c084fc]/10 text-[#c084fc]' : 'text-[#b3b3b3]',
                ].join(' ')}
              >
                <CharAvatar combatant={c} />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-[#444]">Nenhum personagem encontrado</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
