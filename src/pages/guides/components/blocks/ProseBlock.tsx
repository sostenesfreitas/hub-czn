import { useTranslation } from 'react-i18next'
import { resolveLang, localized } from '../../guides.utils'
import type { LocalizedText } from '../../guides.types'

export function ProseBlock({ body }: { body: LocalizedText }) {
  const { i18n } = useTranslation()
  const lang = resolveLang(i18n.language)
  return (
    <p className="text-sm leading-relaxed text-[#cbd5e1] whitespace-pre-line">
      {localized(body, lang)}
    </p>
  )
}
