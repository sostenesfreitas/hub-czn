import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown, Loader2 } from 'lucide-react'
import { assetUrl } from '@/lib/api'

export interface ComboboxOption {
  id: string
  label: string
  icon_path?: string
}

interface SetComboboxProps {
  options: ComboboxOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  maxSelect: number
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
}

export function SetCombobox({
  options,
  selected,
  onChange,
  maxSelect,
  placeholder = 'Buscar...',
  disabled = false,
  isLoading = false,
}: SetComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) &&
      !selected.includes(o.id)
  )

  function add(id: string) {
    if (maxSelect === 1) {
      onChange([id])
    } else if (selected.length < maxSelect) {
      onChange([...selected, id])
    }
    setQuery('')
    setOpen(false)
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s !== id))
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const atMax = selected.length >= maxSelect && maxSelect !== 99
  const inputDisabled = disabled || isLoading || (atMax && maxSelect > 1)

  return (
    <div ref={containerRef} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map((id) => {
            const opt = options.find((o) => o.id === id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 bg-[#c084fc]/20 border border-[#c084fc]/40 text-[#c084fc] text-xs rounded px-2 py-0.5"
              >
                {opt?.icon_path && (
                  <img
                    src={assetUrl(opt.icon_path)}
                    alt=""
                    className="w-3.5 h-3.5 object-contain shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                {opt?.label ?? id}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    aria-label={`Remover ${opt?.label ?? id}`}
                    className="hover:text-[#ffffff] transition-colors"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      <div className="relative">
        {isLoading ? (
          <Loader2
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#b3b3b3] animate-spin"
          />
        ) : (
          <ChevronDown
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#b3b3b3] pointer-events-none"
          />
        )}
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          disabled={inputDisabled}
          placeholder={
            atMax && maxSelect === 1
              ? (options.find((o) => o.id === selected[0])?.label ?? placeholder)
              : placeholder
          }
          className={[
            'w-full bg-[#282828] border border-[#333333] rounded px-2.5 py-1.5 text-xs',
            'text-[#ffffff] placeholder-[#333333] outline-none focus:border-[#c084fc]',
            isLoading ? 'pl-7' : '',
            inputDisabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        />
      </div>

      {open && !inputDisabled && filtered.length > 0 && (
        <div role="listbox" className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#181818] border border-[#282828] rounded shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              onClick={() => add(opt.id)}
              className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-[#ffffff] hover:bg-[#282828] transition-colors"
            >
              {opt.icon_path && (
                <img
                  src={assetUrl(opt.icon_path)}
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              )}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
