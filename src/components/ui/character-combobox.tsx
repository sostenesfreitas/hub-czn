import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, User } from 'lucide-react'
import { assetUrl } from '@/lib/api'
import type { Combatant } from '@/lib/types'

interface CharacterComboboxProps {
  combatants: Combatant[]
  value: string
  onChange: (charId: string) => void
  disabled?: boolean
  placeholder?: string
  ariaLabel?: string
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
      alt=""
      className="w-6 h-6 rounded-full object-cover shrink-0"
      onError={() => setError(true)}
    />
  )
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function CharacterCombobox({
  combatants,
  value,
  onChange,
  disabled,
  placeholder = 'Selecionar...',
  ariaLabel,
}: CharacterComboboxProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const baseId = useId()
  const triggerId = `${baseId}-trigger`
  const listboxId = `${baseId}-listbox`

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => searchRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFilter('')
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  const selected = combatants.find((c) => c.char_id === value)
  const nf = normalize(filter)
  const filtered = filter
    ? combatants.filter((c) => normalize(c.name).includes(nf))
    : combatants

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          setOpen((o) => !o)
          setFilter('')
          setActiveIndex(-1)
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
              ref={searchRef}
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeIndex >= 0 && filtered[activeIndex]
                  ? `${baseId}-option-${filtered[activeIndex].char_id}`
                  : undefined
              }
              aria-label="Buscar personagem"
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setActiveIndex(-1) }}
              placeholder="Buscar..."
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActiveIndex((i) => Math.max(i - 1, -1))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (activeIndex >= 0 && activeIndex < filtered.length) {
                    onChange(filtered[activeIndex].char_id)
                    setOpen(false)
                    setFilter('')
                    setActiveIndex(-1)
                    triggerRef.current?.focus()
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setOpen(false)
                  setFilter('')
                  setActiveIndex(-1)
                  triggerRef.current?.focus()
                }
              }}
              className="w-full bg-transparent text-xs text-[#b3b3b3] outline-none placeholder:text-[#444]"
            />
          </div>
          <div id={listboxId} role="listbox" className="overflow-y-auto max-h-48">
            {filtered.map((c, i) => (
              <div
                key={c.char_id}
                id={`${baseId}-option-${c.char_id}`}
                role="option"
                aria-selected={c.char_id === value}
                tabIndex={-1}
                onClick={() => {
                  onChange(c.char_id)
                  setOpen(false)
                  setFilter('')
                  setActiveIndex(-1)
                  triggerRef.current?.focus()
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={[
                  'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left cursor-pointer hover:bg-[#282828]',
                  c.char_id === value ? 'bg-[#c084fc]/10 text-[#c084fc]' : 'text-[#b3b3b3]',
                  activeIndex === i ? 'bg-[#282828]' : '',
                ].filter(Boolean).join(' ')}
              >
                <CharAvatar combatant={c} />
                <span className="truncate">{c.name}</span>
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#444]">Nenhum personagem encontrado</p>
          )}
        </div>
      )}
    </div>
  )
}
