import { useState, useRef, useEffect, KeyboardEvent } from 'react'
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
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

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
    setHighlightedIdx(null)
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s !== id))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setHighlightedIdx(filtered.length > 0 ? 0 : null)
        return
      }
      if (filtered.length === 0) return
      setHighlightedIdx((idx) => {
        if (idx === null) return 0
        return Math.min(idx + 1, filtered.length - 1)
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (filtered.length === 0) return
      setHighlightedIdx((idx) => {
        if (idx === null || idx <= 0) return 0
        return idx - 1
      })
    } else if (e.key === 'Enter') {
      if (open && highlightedIdx !== null && filtered[highlightedIdx]) {
        e.preventDefault()
        add(filtered[highlightedIdx].id)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
        setHighlightedIdx(null)
      }
    } else if (e.key === 'Tab') {
      // Don't trap focus; just close the dropdown
      setOpen(false)
      setHighlightedIdx(null)
    }
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setHighlightedIdx(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // Reset highlight when filter changes or dropdown reopens with new options
  useEffect(() => {
    setHighlightedIdx(null)
  }, [query])

  // Keep highlight within bounds if the filtered list shrinks
  useEffect(() => {
    if (highlightedIdx !== null && highlightedIdx >= filtered.length) {
      setHighlightedIdx(filtered.length > 0 ? filtered.length - 1 : null)
    }
  }, [filtered.length, highlightedIdx])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIdx === null || !listRef.current) return
    const el = listRef.current.children[highlightedIdx] as HTMLElement | undefined
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIdx])

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
          aria-controls="setcombobox-listbox"
          aria-activedescendant={
            open && highlightedIdx !== null && filtered[highlightedIdx]
              ? `setcombobox-option-${filtered[highlightedIdx].id}`
              : undefined
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
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
        <div
          ref={listRef}
          id="setcombobox-listbox"
          role="listbox"
          className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#181818] border border-[#282828] rounded shadow-lg max-h-48 overflow-y-auto"
        >
          {filtered.map((opt, idx) => (
            <button
              key={opt.id}
              id={`setcombobox-option-${opt.id}`}
              type="button"
              role="option"
              aria-selected={idx === highlightedIdx}
              onClick={() => add(opt.id)}
              onMouseEnter={() => setHighlightedIdx(idx)}
              className={[
                'w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-[#ffffff] transition-colors',
                idx === highlightedIdx ? 'bg-[#282828]' : 'hover:bg-[#282828]',
              ].join(' ')}
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
