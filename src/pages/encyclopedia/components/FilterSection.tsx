import { useTranslation } from 'react-i18next'

export function FilterSection({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string | null
  onChange: (v: string | null) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-0.5">
      <p className="mb-0.5 text-[10px] uppercase tracking-wide text-[#666]">{label}</p>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded px-2 py-1 text-left text-xs transition-colors ${
          value === null ? 'bg-[#c084fc] text-white' : 'text-[#888] hover:bg-[#222] hover:text-[#e5e7eb]'
        }`}
      >
        {t('encyclopedia.all')}
      </button>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded px-2 py-1 text-left text-xs transition-colors ${
            value === opt ? 'bg-[#c084fc] text-white' : 'text-[#888] hover:bg-[#222] hover:text-[#e5e7eb]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
