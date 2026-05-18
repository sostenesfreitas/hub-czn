import { Popover } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { glossaryById } from '../encyclopedia-content'
import { localized, resolveLang } from '../encyclopedia.utils'

export function GlossaryTerm({ termId, children }: { termId: string; children: string }) {
  const { i18n } = useTranslation()
  const lang = resolveLang(i18n.language)
  const entry = glossaryById.get(termId)

  if (!entry) return <>{children}</>

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent p-0 text-[#c084fc] underline decoration-dotted underline-offset-2 hover:text-[#d8b4fe]"
        >
          {children}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 max-w-[260px] rounded-md border border-[#444] bg-[#1e1e1e] p-3 text-xs text-[#d4d4d4] shadow-xl"
          sideOffset={4}
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <p className="mb-1 font-bold text-[#e9d5ff]">{localized(entry.term, lang)}</p>
          <p className="leading-relaxed">{localized(entry.definition, lang)}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
